const knex = require('knex');
const config = require('../knexfile');

const db = knex(config);

db.raw('SELECT 1')
  .then(() => console.log('✅ Database connected'))
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = db;
