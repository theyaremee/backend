require('dotenv').config();

const config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: { directory: './db/migrations' },
  seeds: { directory: './db/seeds' }
};

module.exports = config;
