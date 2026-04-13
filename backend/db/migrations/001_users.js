exports.up = function (knex) {
  return knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.bigInteger('telegram_id').notNullable().unique();
    t.string('telegram_username', 100);
    t.string('first_name', 100);
    t.enu('gender', ['male', 'female']).nullable();
    t.boolean('is_vip').notNullable().defaultTo(false);
    t.timestamp('vip_expires_at').nullable();
    t.integer('token_balance').notNullable().defaultTo(0);
    t.string('referral_code', 12).notNullable().unique();
    t.uuid('referred_by').nullable().references('id').inTable('users');
    t.integer('skip_count_today').notNullable().defaultTo(0);
    t.date('skip_reset_date').nullable();
    t.boolean('is_banned').notNullable().defaultTo(false);
    t.string('ban_reason', 255).nullable();
    t.string('device_hash', 64).nullable();
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('users');
};
