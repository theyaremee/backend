const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const tokenService = require('./token.js');

// In-memory queue: Map<userId, QueueEntry>
const queue = new Map();

const QUEUE_TIMEOUT_MS = 60 * 1000; // 60 seconds
const SKIP_LIMIT_FREE = 5;

/**
 * @typedef {Object} QueueEntry
 * @property {string} userId
 * @property {string} gender - 'male' | 'female'
 * @property {string} genderPreference - 'any' | 'male' | 'female'
 * @property {boolean} isVip
 * @property {boolean} usedToken - whether a token was spent for this entry
 * @property {number} enteredAt - Date.now()
 * @property {NodeJS.Timeout} timeoutHandle
 * @property {Function} onMatch - callback(sessionId, peerId, role)
 * @property {Function} onTimeout - callback()
 */

/**
 * Checks gender compatibility between two queue entries.
 * Both sides must accept each other.
 */
function genderCompatible(a, b) {
  const aAcceptsB = a.genderPreference === 'any' || a.genderPreference === b.gender;
  const bAcceptsA = b.genderPreference === 'any' || b.genderPreference === a.gender;
  return aAcceptsB && bAcceptsA;
}

/**
 * Finds the best match for a new queue entry from existing queue.
 * Priority: VIP-to-VIP, then longest wait time (FIFO).
 */
function findMatch(newEntry) {
  const candidates = [...queue.values()]
    .filter(e => e.userId !== newEntry.userId)
    .filter(e => genderCompatible(newEntry, e))
    .sort((a, b) => {
      if (a.isVip !== b.isVip) return (b.isVip ? 1 : 0) - (a.isVip ? 1 : 0);
      return a.enteredAt - b.enteredAt;
    });

  return candidates[0] || null;
}

/**
 * Creates a session record in the database.
 */
async function createSession(user1Id, user2Id) {
  const [session] = await db('sessions')
    .insert({ user_1_id: user1Id, user_2_id: user2Id, status: 'active' })
    .returning('*');
  return session;
}

/**
 * Handles queue timeout — removes user, refunds token if applicable.
 */
async function handleTimeout(entry) {
  queue.delete(entry.userId);
  if (entry.usedToken) {
    try {
      await tokenService.refundToken(entry.userId, 'queue_timeout_refund');
    } catch (err) {
      console.error('Token refund failed:', err.message);
    }
  }
  entry.onTimeout();
}

/**
 * Enters a user into the matchmaking queue.
 */
async function enterQueue({ userId, gender, isVip, genderPreference = 'any', useToken = false, onMatch, onTimeout }) {
  if (queue.has(userId)) {
    throw Object.assign(new Error('already_in_queue'), { code: 'already_in_queue' });
  }

  let usedToken = false;

  if (useToken) {
    await tokenService.spendToken(userId);
    usedToken = true;
  }

  const entry = {
    userId,
    gender,
    genderPreference: useToken ? genderPreference : 'any',
    isVip,
    usedToken,
    enteredAt: Date.now(),
    onMatch,
    onTimeout,
    timeoutHandle: null
  };

  entry.timeoutHandle = setTimeout(() => handleTimeout(entry), QUEUE_TIMEOUT_MS);

  queue.set(userId, entry);

  const match = findMatch(entry);

  if (match) {
    clearTimeout(entry.timeoutHandle);
    clearTimeout(match.timeoutHandle);
    queue.delete(entry.userId);
    queue.delete(match.userId);

    const session = await createSession(entry.userId, match.userId);

    entry.onMatch(session.id, match.userId, 'caller');
    match.onMatch(session.id, entry.userId, 'callee');
  }
}

/**
 * Removes a user from the queue (e.g., they cancelled).
 */
async function leaveQueue(userId, refundToken = false) {
  const entry = queue.get(userId);
  if (!entry) return;

  clearTimeout(entry.timeoutHandle);
  queue.delete(userId);

  if (refundToken && entry.usedToken) {
    await tokenService.refundToken(userId, 'user_cancelled_queue');
  }
}

/**
 * Handles a skip action. Enforces skip limits for free users.
 */
async function handleSkip(userId, sessionId) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new Error('user_not_found');

  if (!user.is_vip) {
    const today = new Date().toISOString().split('T')[0];
    if (user.skip_reset_date !== today) {
      await db('users').where({ id: userId }).update({
        skip_count_today: 0,
        skip_reset_date: today
      });
      user.skip_count_today = 0;
    }
    if (user.skip_count_today >= SKIP_LIMIT_FREE) {
      return { error: 'skip_limit_reached', skips_remaining: 0 };
    }
    await db('users').where({ id: userId }).increment('skip_count_today', 1);
  }

  await db('sessions').where({ id: sessionId }).update({
    status: 'ended',
    end_reason: 'skipped',
    ended_at: db.fn.now()
  });

  return { ok: true, skips_remaining: user.is_vip ? null : SKIP_LIMIT_FREE - user.skip_count_today - 1 };
}

function getQueueSize() {
  return queue.size;
}

module.exports = { enterQueue, leaveQueue, handleSkip, getQueueSize };
