const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('sidepanel html keeps gmail registration mode row and custom pool section', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(html, /id="row-gmail-registration-mode"/);
  assert.match(html, /data-gmail-registration-mode="alias"/);
  assert.match(html, /data-gmail-registration-mode="custom_pool"/);
  assert.match(html, /id="gmail-custom-pool-section"/);
});

test('sidepanel only treats gmail alias mode as generated alias provider', () => {
  const bundle = [
    extractFunction('normalizeGmailRegistrationMode'),
    extractFunction('isGmailCustomPoolMode'),
    extractFunction('isManagedAliasProvider'),
    extractFunction('usesGeneratedAliasMailProvider'),
  ].join('\n');

  const api = new Function(`
const GMAIL_PROVIDER = 'gmail';
const MAIL_2925_MODE_PROVIDE = 'provide';
const MAIL_2925_MODE_RECEIVE = 'receive';
const DEFAULT_MAIL_2925_MODE = MAIL_2925_MODE_PROVIDE;
const GMAIL_REGISTRATION_MODE_ALIAS = 'alias';
const GMAIL_REGISTRATION_MODE_CUSTOM_POOL = 'custom_pool';
const DEFAULT_GMAIL_REGISTRATION_MODE = GMAIL_REGISTRATION_MODE_ALIAS;
const selectMailProvider = { value: 'gmail' };

function normalizeMail2925Mode(value = '') {
  return String(value || '').trim().toLowerCase() === MAIL_2925_MODE_RECEIVE
    ? MAIL_2925_MODE_RECEIVE
    : DEFAULT_MAIL_2925_MODE;
}

function getSelectedMail2925Mode() {
  return MAIL_2925_MODE_PROVIDE;
}

function getSelectedGmailRegistrationMode() {
  return GMAIL_REGISTRATION_MODE_ALIAS;
}

function getManagedAliasUtils() {
  return {
    usesManagedAliasGeneration(provider, options = {}) {
      const normalizedProvider = String(provider || '').trim().toLowerCase();
      if (normalizedProvider === 'gmail') {
        return String(options.gmailRegistrationMode || '').trim().toLowerCase() !== 'custom_pool';
      }
      return normalizedProvider === '2925'
        && normalizeMail2925Mode(options.mail2925Mode) === MAIL_2925_MODE_PROVIDE;
    },
  };
}

${bundle}

return {
  normalizeGmailRegistrationMode,
  isGmailCustomPoolMode,
  isManagedAliasProvider,
  usesGeneratedAliasMailProvider,
};
`)();

  assert.equal(api.normalizeGmailRegistrationMode('custom_pool'), 'custom_pool');
  assert.equal(api.isGmailCustomPoolMode('gmail', 'custom_pool'), true);
  assert.equal(api.isManagedAliasProvider('gmail', 'provide', 'alias'), true);
  assert.equal(api.isManagedAliasProvider('gmail', 'provide', 'custom_pool'), false);
  assert.equal(api.usesGeneratedAliasMailProvider('gmail', 'provide', 'alias'), true);
  assert.equal(api.usesGeneratedAliasMailProvider('gmail', 'provide', 'custom_pool'), false);
});
