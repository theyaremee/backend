exports.up = function (knex) {
  return knex.schema
    .createTable('tasks', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.enu('type', ['telegram_follow', 'x_follow', 'watch_ad']).notNullable();
      t.string('label', 100).notNullable();
      t.integer('reward_tokens').notNullable().defaultTo(1);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.string('action_url', 500).nullable();
      t.string('verification_channel_id', 100).nullable();
      t.timestamps(true, true);
    })
    .createTable('user_tasks', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
      t.timestamp('completed_at').notNullable().defaultTo(knex.fn.now());
      t.unique(['user_id', 'task_id']);
    })
    .createTable('referrals', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('referrer_id').notNullable().references('id').inTable('users');
      t.uuid('referred_id').notNullable().unique().references('id').inTable('users');
      t.boolean('is_valid').notNullable().defaultTo(false);
      t.timestamp('reward_granted_at').nullable();
      t.timestamps(true, true);
    })
    .createTable('transactions', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('users');
      t.enu('method', ['stars', 'qris']).notNullable();
      t.enu('vip_plan', ['7d', '30d', 'lifetime']).notNullable();
      t.enu('status', ['pending', 'success', 'failed', 'refunded']).notNullable().defaultTo('pending');
      t.string('external_ref', 255).nullable();
      t.decimal('amount_usd', 10, 2).nullable();
      t.timestamps(true, true);
    })
    .createTable('reports', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('reporter_id').notNullable().references('id').inTable('users');
      t.uuid('reported_id').notNullable().references('id').inTable('users');
      t.uuid('session_id').nullable().references('id').inTable('sessions');
      t.enu('reason', ['harassment', 'spam', 'inappropriate', 'other']).notNullable();
      t.enu('status', ['pending', 'reviewed', 'actioned', 'dismissed']).notNullable().defaultTo('pending');
      t.text('notes').nullable();
      t.timestamps(true, true);
    })
    .createTable('token_ledger', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('users');
      t.integer('delta').notNullable();
      t.string('reason', 100).notNullable();
      t.integer('balance_after').notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('token_ledger')
    .dropTableIfExists('reports')
    .dropTableIfExists('transactions')
    .dropTableIfExists('referrals')
    .dropTableIfExists('user_tasks')
    .dropTableIfExists('tasks');
};
