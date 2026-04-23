(function gmailCustomPoolUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.GmailCustomPoolUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createGmailCustomPoolUtils() {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  function normalizeTimestamp(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0 ? value : 0;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function normalizeGmailCustomPoolEmail(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function isValidGmailCustomPoolEmail(value = '') {
    return EMAIL_PATTERN.test(normalizeGmailCustomPoolEmail(value));
  }

  function normalizeGmailCustomPoolAccount(account = {}) {
    const email = normalizeGmailCustomPoolEmail(account.email);
    return {
      id: String(account.id || email),
      email,
      used: Boolean(account.used),
      lastUsedAt: normalizeTimestamp(account.lastUsedAt),
      createdAt: normalizeTimestamp(account.createdAt),
    };
  }

  function normalizeGmailCustomPoolAccounts(accounts) {
    if (!Array.isArray(accounts)) {
      return [];
    }

    const deduped = new Map();
    for (const account of accounts) {
      const normalized = normalizeGmailCustomPoolAccount(account);
      if (!isValidGmailCustomPoolEmail(normalized.email)) {
        continue;
      }
      const key = normalized.email;
      const existing = deduped.get(key);
      deduped.set(key, {
        ...existing,
        ...normalized,
        id: normalized.id || existing?.id || normalized.email,
        createdAt: normalized.createdAt || existing?.createdAt || 0,
      });
    }

    return Array.from(deduped.values());
  }

  function findGmailCustomPoolAccount(accounts, accountIdOrEmail) {
    const normalizedValue = normalizeGmailCustomPoolEmail(accountIdOrEmail);
    if (!normalizedValue) {
      return null;
    }

    return normalizeGmailCustomPoolAccounts(accounts).find((account) => (
      String(account.id || '').trim() === String(accountIdOrEmail || '').trim()
      || account.email === normalizedValue
    )) || null;
  }

  function isGmailCustomPoolAccountAvailable(account) {
    return Boolean(account?.email) && !Boolean(account?.used);
  }

  function filterGmailCustomPoolAccountsByUsage(accounts, mode = 'all') {
    const normalizedAccounts = normalizeGmailCustomPoolAccounts(accounts);
    if (mode === 'used') {
      return normalizedAccounts.filter((account) => Boolean(account.used));
    }
    if (mode === 'unused') {
      return normalizedAccounts.filter((account) => !account.used);
    }
    return normalizedAccounts;
  }

  function upsertGmailCustomPoolAccountInList(accounts, nextAccount) {
    const list = normalizeGmailCustomPoolAccounts(accounts);
    const normalized = normalizeGmailCustomPoolAccount(nextAccount);
    if (!isValidGmailCustomPoolEmail(normalized.email)) {
      return list;
    }

    const existing = findGmailCustomPoolAccount(list, normalized.id) || findGmailCustomPoolAccount(list, normalized.email);
    if (!existing) {
      return [...list, normalized];
    }

    return list.map((account) => (
      account.email === existing.email
        ? {
          ...existing,
          ...normalized,
          id: existing.id || normalized.id,
          createdAt: existing.createdAt || normalized.createdAt,
        }
        : account
    ));
  }

  function pickGmailCustomPoolAccountForRun(accounts, options = {}) {
    const candidates = normalizeGmailCustomPoolAccounts(accounts).filter(isGmailCustomPoolAccountAvailable);
    if (!candidates.length) {
      return null;
    }

    const excludeIds = new Set((options.excludeIds || []).map((id) => String(id || '').trim()).filter(Boolean));
    const filtered = candidates.filter((account) => !excludeIds.has(account.id));
    const pool = filtered.length ? filtered : candidates;

    return pool
      .slice()
      .sort((left, right) => {
        const leftLastUsedAt = normalizeTimestamp(left.lastUsedAt);
        const rightLastUsedAt = normalizeTimestamp(right.lastUsedAt);
        if (leftLastUsedAt !== rightLastUsedAt) {
          return leftLastUsedAt - rightLastUsedAt;
        }

        const leftCreatedAt = normalizeTimestamp(left.createdAt);
        const rightCreatedAt = normalizeTimestamp(right.createdAt);
        if (leftCreatedAt !== rightCreatedAt) {
          return leftCreatedAt - rightCreatedAt;
        }

        return String(left.email || '').localeCompare(String(right.email || ''));
      })[0] || null;
  }

  function parseGmailCustomPoolImportText(rawText) {
    const deduped = new Map();
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const [index, line] of lines.entries()) {
      if (index === 0 && /^(?:邮箱|email)$/i.test(line)) {
        continue;
      }
      const email = normalizeGmailCustomPoolEmail(line);
      if (!isValidGmailCustomPoolEmail(email)) {
        continue;
      }
      deduped.set(email, { email });
    }

    return Array.from(deduped.values());
  }

  function getGmailCustomPoolBulkActionLabel(mode = 'all', count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const prefix = mode === 'used' ? '清空已用' : '全部删除';
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${prefix}${suffix}`;
  }

  function getGmailCustomPoolListToggleLabel(expanded, count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${expanded ? '收起列表' : '展开列表'}${suffix}`;
  }

  function shouldClearGmailCustomPoolCurrentSelection(account) {
    return Boolean(account) && Boolean(account.used);
  }

  return {
    filterGmailCustomPoolAccountsByUsage,
    findGmailCustomPoolAccount,
    getGmailCustomPoolBulkActionLabel,
    getGmailCustomPoolListToggleLabel,
    isGmailCustomPoolAccountAvailable,
    isValidGmailCustomPoolEmail,
    normalizeGmailCustomPoolAccount,
    normalizeGmailCustomPoolAccounts,
    normalizeGmailCustomPoolEmail,
    normalizeTimestamp,
    parseGmailCustomPoolImportText,
    pickGmailCustomPoolAccountForRun,
    shouldClearGmailCustomPoolCurrentSelection,
    upsertGmailCustomPoolAccountInList,
  };
});
