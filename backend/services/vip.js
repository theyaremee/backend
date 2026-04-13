const db = require('../db/connection');
const notification = require('./notification.js');

const VIP_PLANS = {
  '7d':       { days: 7,    label: 'VIP Weekly',   stars: 99,  idr: 25000 },
  '30d':      { days: 30,   label: 'VIP Monthly',  stars: 299, idr: 69000 },
  'lifetime': { days: null, label: 'VIP Lifetime', stars: 999, idr: 199000 }
};

function getPlanExpiry(plan) {
  if (plan === 'lifetime') return null;
  const d = new Date();
  d.setDate(d.getDate() + VIP_PLANS[plan].days);
  return d;
}

async function activateVip(userId, plan) {
  const expiry = getPlanExpiry(plan);
  await db('users').where({ id: userId }).update({
    is_vip: true,
    vip_expires_at: expiry
  });
  return { is_vip: true, vip_expires_at: expiry, plan };
}

/**
 * Check if a user's VIP is still active.
 * Handles both lifetime (null expiry) and time-based.
 */
function isVipActive(user) {
  if (!user.is_vip) return false;
  if (!user.vip_expires_at) return true; // lifetime
  return new Date(user.vip_expires_at) > new Date();
}

/**
 * Expire stale VIP accounts. Run every hour via cron.
 */
async function expireStaleVip() {
  const expired = await db('users')
    .where('is_vip', true)
    .whereNotNull('vip_expires_at')
    .where('vip_expires_at', '<=', db.fn.now())
    .returning(['id', 'telegram_id']);

  if (expired.length === 0) return;

  await db('users')
    .whereIn('id', expired.map(u => u.id))
    .update({ is_vip: false });

  for (const u of expired) {
    await notification.notifyVipExpired(u.telegram_id).catch(() => {});
  }

  console.log(`[VIP Cron] Expired ${expired.length} VIP accounts`);
}

/**
 * Notify users whose VIP expires in ~24 hours. Run every hour via cron.
 */
async function notifyExpiringVip() {
  const inWindow = await db('users')
    .where('is_vip', true)
    .whereNotNull('vip_expires_at')
    .whereBetween('vip_expires_at', [
      db.raw("NOW() + INTERVAL '23 hours'"),
      db.raw("NOW() + INTERVAL '25 hours'")
    ])
    .returning(['id', 'telegram_id']);

  for (const u of inWindow) {
    await notification.notifyVipExpiringSoon(u.telegram_id).catch(() => {});
  }
}

module.exports = { VIP_PLANS, activateVip, isVipActive, expireStaleVip, notifyExpiringVip };
