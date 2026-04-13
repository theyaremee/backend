const db = require('../db/connection');
const tokenService = require('../services/token.js');

async function listTasks(req, res) {
  const tasks = await db('tasks').orderBy('is_active', 'desc');
  const completed = await db('user_tasks')
    .where({ user_id: req.user.userId })
    .pluck('task_id');

  const completedSet = new Set(completed);

  return res.json({
    tasks: tasks.map(t => ({
      id: t.id,
      type: t.type,
      label: t.label,
      reward_tokens: t.reward_tokens,
      is_active: t.is_active,
      action_url: t.action_url,
      completed: completedSet.has(t.id)
    }))
  });
}

async function claimTask(req, res) {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).json({ error: 'missing_task_id' });

  const task = await db('tasks').where({ id: task_id, is_active: true }).first();
  if (!task) return res.status(404).json({ error: 'task_not_found_or_inactive' });

  const already = await db('user_tasks')
    .where({ user_id: req.user.userId, task_id })
    .first();
  if (already) return res.status(409).json({ error: 'task_already_completed' });

  await db('user_tasks').insert({
    user_id: req.user.userId,
    task_id
  });

  const { new_balance, awarded } = await tokenService.awardTokens(
    req.user.userId,
    task.reward_tokens,
    `task_${task.type}`
  );

  // Check if referral should be validated
  await checkReferralValidation(req.user.userId);

  return res.json({ ok: true, awarded, new_balance });
}

/**
 * After each task completion, check if referred user has now completed 2 tasks.
 * If so, reward the referrer.
 */
async function checkReferralValidation(userId) {
  const referral = await db('referrals')
    .where({ referred_id: userId, is_valid: false })
    .first();
  if (!referral) return;

  const taskCount = await db('user_tasks')
    .where({ user_id: userId })
    .count('id as count')
    .first();

  if (parseInt(taskCount.count) >= 2) {
    await db('referrals').where({ id: referral.id }).update({
      is_valid: true,
      reward_granted_at: db.fn.now()
    });

    const { awarded } = await tokenService.awardTokens(
      referral.referrer_id,
      2,
      'referral_reward'
    );

    if (awarded > 0) {
      const referrer = await db('users').where({ id: referral.referrer_id }).first();
      const { notifyReferralReward } = require('../services/notification.js');
      await notifyReferralReward(referrer.telegram_id, awarded).catch(() => {});
    }
  }
}

module.exports = { listTasks, claimTask };
