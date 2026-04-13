const express = require('express');
const { requireAuth } = require('../middleware/auth.js');
const { requireAdmin } = require('../middleware/admin.js');
const { queueLimit, taskLimit, paymentLimit } = require('../middleware/rateLimit.js');

const authCtrl     = require('../controllers/auth.js');
const userCtrl     = require('../controllers/users.js');
const taskCtrl     = require('../controllers/tasks.js');
const referralCtrl = require('../controllers/referrals.js');
const paymentCtrl  = require('../controllers/payments.js');
const adminCtrl    = require('../controllers/admin.js');

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/login',   authCtrl.login);
router.post('/auth/refresh', authCtrl.refresh);

// ── User ──────────────────────────────────────────────────────────────────────
router.get('/me',              requireAuth, userCtrl.getMe);
router.post('/me/gender',      requireAuth, userCtrl.setGender);
router.get('/me/tokens',       requireAuth, userCtrl.getTokenHistory);

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.get('/tasks',       requireAuth,            taskCtrl.listTasks);
router.post('/tasks/claim', requireAuth, taskLimit, taskCtrl.claimTask);

// ── Referrals ─────────────────────────────────────────────────────────────────
router.get('/referrals', requireAuth, referralCtrl.getMyReferrals);

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/payments/stars/invoice',    requireAuth, paymentLimit, paymentCtrl.createStarsInvoice);
router.post('/payments/qris/create',      requireAuth, paymentLimit, paymentCtrl.createQrisPayment);
router.post('/webhooks/telegram',         paymentCtrl.handleStarsWebhook);
router.post('/webhooks/midtrans',         paymentCtrl.handleMidtransWebhook);

// ── VIP Plans (public) ────────────────────────────────────────────────────────
router.get('/vip/plans', (req, res) => {
  const { VIP_PLANS } = require('../services/vip.js');
  return res.json({ plans: VIP_PLANS });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats',                    requireAdmin, adminCtrl.getStats);
router.get('/admin/reports',                  requireAdmin, adminCtrl.listReports);
router.post('/admin/reports/:id/action',      requireAdmin, adminCtrl.actionReport);
router.get('/admin/users/:id',                requireAdmin, adminCtrl.getUser);
router.post('/admin/users/:id/ban',           requireAdmin, adminCtrl.banUser);
router.post('/admin/users/:id/unban',         requireAdmin, adminCtrl.unbanUser);
router.post('/admin/users/:id/vip',           requireAdmin, adminCtrl.grantVip);
router.post('/admin/users/:id/tokens',        requireAdmin, adminCtrl.adjustTokens);

module.exports = router;
