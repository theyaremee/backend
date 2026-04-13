const db = require('../db/connection');
const { isVipActive } = require('../services/vip.js');

async function getMe(req, res) {
  const user = await db('users').where({ id: req.user.userId }).first();
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const vipActive = isVipActive(user);

  return res.json({
    id: user.id,
    gender: user.gender,
    is_vip: vipActive,
    vip_expires_at: user.vip_expires_at,
    token_balance: user.token_balance,
    referral_code: user.referral_code,
    skip_count_today: user.skip_count_today
  });
}

async function setGender(req, res) {
  const { gender } = req.body;
  if (!['male', 'female'].includes(gender)) {
    return res.status(400).json({ error: 'invalid_gender' });
  }

  await db('users').where({ id: req.user.userId }).update({ gender });
  return res.json({ ok: true, gender });
}

async function getTokenHistory(req, res) {
  const history = await db('token_ledger')
    .where({ user_id: req.user.userId })
    .orderBy('created_at', 'desc')
    .limit(50);
  return res.json({ history });
}

module.exports = { getMe, setGender, getTokenHistory };
