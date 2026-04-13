const db = require('../db/connection');

const MAX_BALANCE = 50;

/**
 * Awards tokens to a user atomically.
 * Silently caps at MAX_BALANCE.
 * Returns { new_balance, awarded }.
 */
async function awardTokens(userId, amount, reason) {
  return db.transaction(async (trx) => {
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()
      .first();

    const current = user.token_balance;
    const awarded = Math.min(amount, MAX_BALANCE - current);
    if (awarded <= 0) return { new_balance: current, awarded: 0 };

    const newBalance = current + awarded;
    await trx('users').where({ id: userId }).update({ token_balance: newBalance });

    await trx('token_ledger').insert({
      user_id: userId,
      delta: awarded,
      reason,
      balance_after: newBalance
    });

    return { new_balance: newBalance, awarded };
  });
}

/**
 * Spends one token atomically.
 * Throws 'insufficient_tokens' if balance < 1.
 */
async function spendToken(userId) {
  return db.transaction(async (trx) => {
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()
      .first();

    if (user.token_balance < 1) {
      throw Object.assign(new Error('insufficient_tokens'), { code: 'insufficient_tokens' });
    }

    const newBalance = user.token_balance - 1;
    await trx('users').where({ id: userId }).update({ token_balance: newBalance });

    await trx('token_ledger').insert({
      user_id: userId,
      delta: -1,
      reason: 'gender_filter_match',
      balance_after: newBalance
    });

    return { new_balance: newBalance };
  });
}

/**
 * Refunds one token (e.g., when queue times out).
 */
async function refundToken(userId, reason = 'queue_timeout_refund') {
  return awardTokens(userId, 1, reason);
}

module.exports = { awardTokens, spendToken, refundToken };
