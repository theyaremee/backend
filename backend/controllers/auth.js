const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/connection');
const { validateTelegramInitData } = require('../middleware/auth.js');

function generateReferralCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

function issueToken(userId, telegramId) {
  return jwt.sign(
    { userId, telegram_id: telegramId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function issueRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

async function login(req, res) {
  const { init_data } = req.body;
  if (!init_data) return res.status(400).json({ error: 'missing_init_data' });

  const telegramUser = validateTelegramInitData(init_data, process.env.TELEGRAM_BOT_TOKEN);
  if (!telegramUser) return res.status(401).json({ error: 'invalid_init_data' });

  const { id: telegramId, username, first_name } = telegramUser;

  let user = await db('users').where({ telegram_id: telegramId }).first();

  if (!user) {
    let code = generateReferralCode();
    while (await db('users').where({ referral_code: code }).first()) {
      code = generateReferralCode();
    }

    // Check for referral in init_data start_param
    const params = new URLSearchParams(init_data);
    const startParam = params.get('start_param') || '';
    let referredBy = null;

    if (startParam.startsWith('ref_')) {
      const refCode = startParam.replace('ref_', '');
      const referrer = await db('users').where({ referral_code: refCode }).first();
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    [user] = await db('users').insert({
      telegram_id: telegramId,
      telegram_username: username || null,
      first_name: first_name || null,
      referral_code: code,
      referred_by: referredBy
    }).returning('*');

    if (referredBy) {
      await db('referrals').insert({
        referrer_id: referredBy,
        referred_id: user.id
      });
    }
  }

  if (user.is_banned) {
    return res.status(403).json({ error: 'account_banned', reason: user.ban_reason });
  }

  const token = issueToken(user.id, telegramId);
  const refreshToken = issueRefreshToken(user.id);

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    token,
    user: {
      id: user.id,
      gender: user.gender,
      is_vip: user.is_vip,
      vip_expires_at: user.vip_expires_at,
      token_balance: user.token_balance,
      referral_code: user.referral_code
    }
  });
}

async function refresh(req, res) {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return res.status(401).json({ error: 'missing_refresh_token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('invalid type');

    const user = await db('users').where({ id: payload.userId }).first();
    if (!user || user.is_banned) return res.status(401).json({ error: 'unauthorized' });

    const token = issueToken(user.id, user.telegram_id);
    return res.json({ token });
  } catch {
    return res.status(401).json({ error: 'invalid_refresh_token' });
  }
}

module.exports = { login, refresh };
