const attemptsStore = new Map();

function now() {
  return Date.now();
}

function keyFor(scope, type, subject) {
  return `${scope}:${type}:${String(subject || '').trim().toLowerCase()}`;
}

function getOrCreateEntry(key, windowMs) {
  const entry = attemptsStore.get(key);
  const actual = now();
  if (!entry) {
    const nuevo = { count: 0, firstAt: actual, lastAt: actual, lockedUntil: 0 };
    attemptsStore.set(key, nuevo);
    return nuevo;
  }
  if (entry.lockedUntil && entry.lockedUntil <= actual) {
    entry.count = 0;
    entry.firstAt = actual;
    entry.lockedUntil = 0;
  }
  if ((actual - entry.firstAt) > windowMs) {
    entry.count = 0;
    entry.firstAt = actual;
    entry.lockedUntil = 0;
  }
  entry.lastAt = actual;
  return entry;
}

function parseKey(rawKey = '') {
  const first = rawKey.indexOf(':');
  const second = first >= 0 ? rawKey.indexOf(':', first + 1) : -1;
  return {
    scope: first >= 0 ? rawKey.slice(0, first) : '',
    type: second > first ? rawKey.slice(first + 1, second) : '',
    subject: second >= 0 ? rawKey.slice(second + 1) : ''
  };
}

export function listLoginProtectionEntries({ scope = '', onlyBlocked = false, limit = 100 } = {}) {
  const actual = now();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const out = [];

  for (const [key, entry] of attemptsStore.entries()) {
    const parsed = parseKey(key);
    if (scope && parsed.scope !== scope) continue;

    const blocked = Number(entry?.lockedUntil || 0) > actual;
    if (onlyBlocked && !blocked) continue;

    out.push({
      scope: parsed.scope,
      type: parsed.type,
      subject: parsed.subject,
      count: Number(entry?.count || 0),
      blocked,
      retryAfterSec: blocked ? Math.max(1, Math.ceil((Number(entry.lockedUntil || 0) - actual) / 1000)) : 0,
      firstAt: entry?.firstAt ? new Date(entry.firstAt).toISOString() : '',
      lastAt: entry?.lastAt ? new Date(entry.lastAt).toISOString() : '',
      lockedUntil: entry?.lockedUntil ? new Date(entry.lockedUntil).toISOString() : ''
    });
  }

  return out
    .sort((a, b) => {
      if (Number(b.blocked) !== Number(a.blocked)) return Number(b.blocked) - Number(a.blocked);
      return new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime();
    })
    .slice(0, safeLimit);
}

export function createLoginAttemptManager({
  scope,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  lockMs = 15 * 60 * 1000
} = {}) {
  const safeScope = String(scope || 'login').trim() || 'login';

  function subjects({ identifier = '', ip = '' } = {}) {
    const out = [];
    if (identifier) out.push(keyFor(safeScope, 'id', identifier));
    if (ip) out.push(keyFor(safeScope, 'ip', ip));
    return out;
  }

  function getStatus(payload = {}) {
    const actual = now();
    let lockedUntil = 0;
    for (const key of subjects(payload)) {
      const entry = getOrCreateEntry(key, windowMs);
      if (entry.lockedUntil > actual) {
        lockedUntil = Math.max(lockedUntil, entry.lockedUntil);
      }
    }
    const retryAfterSec = lockedUntil > actual ? Math.max(1, Math.ceil((lockedUntil - actual) / 1000)) : 0;
    return {
      blocked: retryAfterSec > 0,
      retryAfterSec
    };
  }

  function registerFailure(payload = {}) {
    const actual = now();
    let lockedUntil = 0;
    for (const key of subjects(payload)) {
      const entry = getOrCreateEntry(key, windowMs);
      entry.count += 1;
      entry.lastAt = actual;
      if (entry.count >= maxAttempts) {
        entry.lockedUntil = Math.max(entry.lockedUntil || 0, actual + lockMs);
      }
      attemptsStore.set(key, entry);
      lockedUntil = Math.max(lockedUntil, entry.lockedUntil || 0);
    }
    const retryAfterSec = lockedUntil > actual ? Math.max(1, Math.ceil((lockedUntil - actual) / 1000)) : 0;
    return {
      blocked: retryAfterSec > 0,
      retryAfterSec
    };
  }

  function reset(payload = {}) {
    for (const key of subjects(payload)) {
      attemptsStore.delete(key);
    }
  }

  return {
    getStatus,
    registerFailure,
    reset,
    config: { scope: safeScope, maxAttempts, windowMs, lockMs }
  };
}
