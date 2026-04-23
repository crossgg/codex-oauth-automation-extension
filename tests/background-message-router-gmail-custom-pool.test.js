const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/message-router.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

function createRouter(overrides = {}) {
  const events = {
    logs: [],
    patchCalls: [],
    selectCalls: [],
  };

  const router = api.createMessageRouter({
    addLog: async (message, level) => {
      events.logs.push({ message, level });
    },
    buildLocalhostCleanupPrefix: () => '',
    closeLocalhostCallbackTabs: async () => {},
    closeTabsByUrlPrefix: async () => {},
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {},
    getCurrentLuckmailPurchase: () => null,
    getState: async () => overrides.state || {
      mailProvider: 'gmail',
      gmailRegistrationMode: 'custom_pool',
      currentGmailCustomPoolAccountId: 'pool-1',
    },
    isGmailCustomPoolMode: (state) => (
      String(state?.mailProvider || '').trim().toLowerCase() === 'gmail'
      && String(state?.gmailRegistrationMode || '').trim().toLowerCase() === 'custom_pool'
    ),
    isHotmailProvider: () => false,
    isLocalhostOAuthCallbackUrl: () => true,
    isLuckmailProvider: () => false,
    patchGmailCustomPoolAccount: async (accountId, updates) => {
      events.patchCalls.push({ accountId, updates });
      return { id: accountId, email: 'pool.user@example.net', used: true };
    },
    patchMail2925Account: async () => {},
    patchHotmailAccount: async () => {},
    setCurrentGmailCustomPoolAccount: async (accountId, options) => {
      events.selectCalls.push({ accountId, options });
      return { id: accountId, email: 'pool.user@example.net' };
    },
    upsertGmailCustomPoolAccount: async (payload) => ({
      id: 'pool-1',
      email: String(payload?.email || '').trim().toLowerCase(),
    }),
    deleteGmailCustomPoolAccount: async () => {},
    deleteGmailCustomPoolAccounts: async () => ({ deletedCount: 0, remainingCount: 0 }),
  });

  return { router, events };
}

test('message router marks current gmail custom pool account as used on step 10 success', async () => {
  const { router, events } = createRouter();

  await router.handleStepData(10, {
    localhostUrl: 'http://localhost:1455/auth/callback?code=abc&state=xyz',
  });

  assert.deepStrictEqual(events.patchCalls, [
    {
      accountId: 'pool-1',
      updates: {
        used: true,
        lastUsedAt: events.patchCalls[0].updates.lastUsedAt,
      },
    },
  ]);
  assert.equal(typeof events.patchCalls[0].updates.lastUsedAt, 'number');
  assert.equal(events.logs.some(({ message }) => message.includes('pool.user@example.net')), true);
});

test('message router selects gmail custom pool account through dedicated message type', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'SELECT_GMAIL_CUSTOM_POOL_ACCOUNT',
    source: 'sidepanel',
    payload: {
      accountId: 'pool-9',
    },
  }, {});

  assert.deepStrictEqual(events.selectCalls, [
    {
      accountId: 'pool-9',
      options: {
        syncEmail: true,
      },
    },
  ]);
  assert.deepStrictEqual(response, {
    ok: true,
    account: {
      id: 'pool-9',
      email: 'pool.user@example.net',
    },
  });
});
