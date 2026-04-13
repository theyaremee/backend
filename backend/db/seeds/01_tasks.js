exports.seed = async function (knex) {
  await knex('tasks').del();
  await knex('tasks').insert([
    {
      type: 'telegram_follow',
      label: 'Follow our Telegram Channel',
      reward_tokens: 1,
      is_active: true,
      action_url: 'https://t.me/your_channel',
      verification_channel_id: '@your_channel'
    },
    {
      type: 'x_follow',
      label: 'Follow us on X (Twitter)',
      reward_tokens: 1,
      is_active: true,
      action_url: 'https://x.com/your_handle'
    },
    {
      type: 'watch_ad',
      label: 'Watch a Short Ad',
      reward_tokens: 1,
      is_active: false,
      action_url: null
    }
  ]);
};
