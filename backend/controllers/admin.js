const db = require('../db/connection');
const { activateVip } = require('../services/vip.js');
const tokenService = require('../services/token.js');

async function getStats(req, res) {
  const [[users], [sessions], [reports], [vips]] = await Promise.all([
    db('users').count('id as count'),
    db('sessions').count('id as count'),
    db('reports').where({ status: 'pending' }).count('id as count'),
    db('users').where({ is_vip: true }).count('id as count')
  ]);
  return res.json({
    total_users: parseInt(users.count),
    total_sessions: parseInt(sessions.count),
    pending_reports: parseInt(reports.count),
    active_vips: parseInt(vips.count)
  });
}

async function listReports(req, res) {
  const { status = 'pending', limit = 50, offset = 0 } = req.query;
  const reports = await db('reports')
    .where(status !== 'all' ? { 'reports.status': status } : {})
    .join('users as reporter', 'reporter.id', 'reports.reporter_id')
    .join('users as reported', 'reported.id', 'reports.reported_id')
    .select(
      'reports.*',
      'reporter.telegram_id as reporter_telegram_id',
      'reporter.first_name as reporter_name',
      'reported.telegram_id as reported_telegram_id',
      'reported.first_name as reported_name'
    )
    .orderBy('reports.created_at', 'desc')
    .limit(limit)
    .offset(offset);
  return res.json({ reports });
}

async function actionReport(req, res) {
  const { id } = req.params;
  const { action, ban_reason } = req.body;

  const report = await db('reports').where({ id }).first();
  if (!report) return res.status(404).json({ error: 'not_found' });

  if (action === 'ban') {
    await db('users').where({ id: report.reported_id }).update({
      is_banned: true,
      ban_reason: ban_reason || 'Banned by admin'
    });
  }

  await db('reports').where({ id }).update({
    status: action === 'dismiss' ? 'dismissed' : 'actioned',
    notes: ban_reason || null
  });

  return res.json({ ok: true });
}

async function getUser(req, res) {
  const user = await db('users').where({ id: req.params.id }).first();
  if (!user) return res.status(404).json({ error: 'not_found' });

  const txs = await db('transactions').where({ user_id: user.id }).orderBy('created_at', 'desc').limit(20);
  const tokenHistory = await db('token_ledger').where({ user_id: user.id }).orderBy('created_at', 'desc').limit(20);

  return res.json({ user, transactions: txs, token_history: tokenHistory });
}

async function banUser(req, res) {
  const { reason } = req.body;
  await db('users').where({ id: req.params.id }).update({
    is_banned: true,
    ban_reason: reason || 'Banned by admin'
  });
  return res.json({ ok: true });
}

async function unbanUser(req, res) {
  await db('users').where({ id: req.params.id }).update({ is_banned: false, ban_reason: null });
  return res.json({ ok: true });
}

async function grantVip(req, res) {
  const { plan } = req.body;
  if (!['7d', '30d', 'lifetime'].includes(plan)) return res.status(400).json({ error: 'invalid_plan' });
  const result = await activateVip(req.params.id, plan);
  return res.json({ ok: true, ...result });
}

async function adjustTokens(req, res) {
  const { delta, reason } = req.body;
  if (typeof delta !== 'number') return res.status(400).json({ error: 'invalid_delta' });

  let result;
  if (delta > 0) {
    result = await tokenService.awardTokens(req.params.id, delta, reason || 'admin_grant');
  } else {
    // Manual deduction
    result = await db.transaction(async trx => {
      const user = await trx('users').where({ id: req.params.id }).forUpdate().first();
      const newBal = Math.max(0, user.token_balance + delta);
      await trx('users').where({ id: req.params.id }).update({ token_balance: newBal });
      await trx('token_ledger').insert({ user_id: req.params.id, delta, reason: reason || 'admin_deduct', balance_after: newBal });
      return { new_balance: newBal };
    });
  }
  return res.json({ ok: true, ...result });
}

module.exports = { getStats, listReports, actionReport, getUser, banUser, unbanUser, grantVip, adjustTokens };
