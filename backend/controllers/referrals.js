const db = require('../db/connection');

async function getMyReferrals(req, res) {
  const user = await db('users').where({ id: req.user.userId }).first();

  const referrals = await db('referrals')
    .where({ referrer_id: req.user.userId })
    .join('users', 'users.id', 'referrals.referred_id')
    .select(
      'referrals.id',
      'referrals.is_valid',
      'referrals.reward_granted_at',
      'referrals.created_at',
      'users.first_name',
      'users.telegram_username'
    )
    .orderBy('referrals.created_at', 'desc');

  const total = referrals.length;
  const valid = referrals.filter(r => r.is_valid).length;
  const tokensEarned = valid * 2;

  return res.json({
    referral_link: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=ref_${user.referral_code}`,
    referral_code: user.referral_code,
    total_referrals: total,
    valid_referrals: valid,
    tokens_earned: tokensEarned,
    referrals
  });
}

module.exports = { getMyReferrals };
