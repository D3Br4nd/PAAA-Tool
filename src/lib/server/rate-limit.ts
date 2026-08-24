/**
 * In-process rate limiting.
 *
 * State lives in this module, so it resets on restart and is not shared across
 * processes. That is acceptable for the current single-process deployment; if
 * the app is ever scaled horizontally this needs to move to the database or a
 * shared cache, otherwise each instance enforces its own quota.
 */

type RateLimitRecord = {
    count: number;
    resetAt: number;
};

type FailureRecord = {
    failures: number;
    lockedUntil: number;
    lastFailureAt: number;
};

const limits = new Map<string, RateLimitRecord>();
const failures = new Map<string, FailureRecord>();

/**
 * Both maps are keyed by attacker-controlled values (IP, email), so an attacker
 * who varies the key on every request would otherwise grow them without bound.
 * Past this size we evict the oldest entries.
 */
const MAX_ENTRIES = 20_000;

function evictIfNeeded<T>(map: Map<string, T>, expiryOf: (record: T) => number) {
    if (map.size <= MAX_ENTRIES) return;

    const now = Date.now();
    for (const [key, record] of map) {
        if (expiryOf(record) <= now) map.delete(key);
    }

    // Still oversized: drop oldest-inserted entries (Map preserves insertion order).
    if (map.size > MAX_ENTRIES) {
        const excess = map.size - MAX_ENTRIES;
        let removed = 0;
        for (const key of map.keys()) {
            map.delete(key);
            if (++removed >= excess) break;
        }
    }
}

/**
 * Fixed-window counter. Every call consumes one attempt, so this measures
 * request volume regardless of outcome — use it for per-IP ceilings.
 *
 * @param key The identifier for the rate limit (e.g., IP address or user ID)
 * @param maxAttempts Maximum allowed attempts within the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number) {
    const now = Date.now();
    let record = limits.get(key);

    if (!record || now > record.resetAt) {
        record = {
            count: 0,
            resetAt: now + windowMs
        };
    }

    record.count++;
    limits.set(key, record);
    evictIfNeeded(limits, (r) => r.resetAt);

    if (record.count > maxAttempts) {
        return {
            success: false,
            remaining: 0,
            resetAt: record.resetAt
        };
    }

    return {
        success: true,
        remaining: maxAttempts - record.count,
        resetAt: record.resetAt
    };
}

const MAX_FAILURES = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
// Failure history is forgotten after a quiet period, so an occasional typo
// weeks apart never accumulates into a lockout.
const FAILURE_DECAY_MS = 30 * 60 * 1000;

/**
 * Consecutive-failure throttle, intended to be keyed by *identity* (an email,
 * a team code) rather than by IP.
 *
 * A per-IP ceiling alone does not slow an attacker who rotates source
 * addresses against a single account, which is exactly the shape of credential
 * stuffing. This counts only failed attempts, so a legitimate user is never
 * penalised for logging in often — call `clearFailures` on success.
 *
 * Tradeoff: anyone can deliberately fail against a known email to lock that
 * account out. The lock is therefore time-bounded (never more than
 * MAX_LOCK_MS) and decays, so the worst case is a delay, not a denied account.
 */
export function checkFailureLock(key: string) {
    const record = failures.get(key);
    if (!record) return { locked: false as const, retryAfterMs: 0 };

    const now = Date.now();

    if (now - record.lastFailureAt > FAILURE_DECAY_MS) {
        failures.delete(key);
        return { locked: false as const, retryAfterMs: 0 };
    }

    if (now < record.lockedUntil) {
        return { locked: true as const, retryAfterMs: record.lockedUntil - now };
    }

    return { locked: false as const, retryAfterMs: 0 };
}

/**
 * Records a failed attempt. Once the allowance is spent, each further failure
 * doubles the lock-out, so sustained guessing against one account becomes
 * exponentially slower while a user who mistypes twice is unaffected.
 */
export function registerFailure(key: string) {
    const now = Date.now();
    const existing = failures.get(key);
    const decayed = existing && now - existing.lastFailureAt > FAILURE_DECAY_MS;

    const record: FailureRecord = decayed || !existing
        ? { failures: 0, lockedUntil: 0, lastFailureAt: now }
        : existing;

    record.failures++;
    record.lastFailureAt = now;

    if (record.failures >= MAX_FAILURES) {
        const overage = record.failures - MAX_FAILURES;
        record.lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** overage, MAX_LOCK_MS);
    }

    failures.set(key, record);
    evictIfNeeded(failures, (r) => r.lastFailureAt + FAILURE_DECAY_MS);
}

/** Clears the failure history for an identity after a successful login. */
export function clearFailures(key: string) {
    failures.delete(key);
}

// Cleanup expired records periodically
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of limits.entries()) {
            if (now > record.resetAt) {
                limits.delete(key);
            }
        }
        for (const [key, record] of failures.entries()) {
            if (now - record.lastFailureAt > FAILURE_DECAY_MS) {
                failures.delete(key);
            }
        }
    }, 60000); // Clean every minute
}
