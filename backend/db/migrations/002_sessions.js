exports.up = function (knex) {
  return knex.schema.createTable('sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_1_id').notNullable().references('id').inTable('users');
    t.uuid('user_2_id').notNullable().references('id').inTable('users');
    t.enu('status', ['active', 'ended', 'failed']).notNullable().defaultTo('active');
    t.enu('end_reason', ['user_ended', 'skipped', 'disconnected', 'timeout']).nullable();
    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('ended_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('sessions');
};
