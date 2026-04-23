const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../gmail-custom-pool-utils.js');

test('gmail custom pool utils parse bulk import as full emails per line', () => {
  const accounts = utils.parseGmailCustomPoolImportText(`
email
Demo@One.COM
invalid-line
demo@one.com
pool.user@two.net
  `);

  assert.deepStrictEqual(accounts, [
    { email: 'demo@one.com' },
    { email: 'pool.user@two.net' },
  ]);
});

test('gmail custom pool utils pick next unused account by least recently used order', () => {
  const account = utils.pickGmailCustomPoolAccountForRun([
    { id: 'acc-1', email: 'used@example.com', used: true, lastUsedAt: 10, createdAt: 1 },
    { id: 'acc-2', email: 'fresh-b@example.com', used: false, lastUsedAt: 20, createdAt: 2 },
    { id: 'acc-3', email: 'fresh-a@example.com', used: false, lastUsedAt: 10, createdAt: 3 },
    { id: 'acc-4', email: 'fresh-c@example.com', used: false, lastUsedAt: 10, createdAt: 1 },
  ]);

  assert.equal(account?.id, 'acc-4');
  assert.equal(account?.email, 'fresh-c@example.com');
});

test('gmail custom pool utils skip excluded ids and fall back to remaining unused accounts', () => {
  const account = utils.pickGmailCustomPoolAccountForRun([
    { id: 'acc-1', email: 'first@example.com', used: false, lastUsedAt: 0, createdAt: 1 },
    { id: 'acc-2', email: 'second@example.com', used: false, lastUsedAt: 5, createdAt: 2 },
  ], {
    excludeIds: ['acc-1'],
  });

  assert.equal(account?.id, 'acc-2');
  assert.equal(account?.email, 'second@example.com');
});
