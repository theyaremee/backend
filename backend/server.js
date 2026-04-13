require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const cookieParser = require('cookie-parser');

const routes    = require('./routes/index.js');
const signaling = require('./services/signaling.js');
const vipService = require('./services/vip.js');
const { globalLimit } = require('./middleware/rateLimit.js');

const app    = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(globalLimit);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── WebSocket signaling ───────────────────────────────────────────────────────
signaling.attachSignalingServer(server);

// ── Cron jobs ─────────────────────────────────────────────────────────────────
// Every hour: expire stale VIP + notify expiring VIP
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Running VIP expiry checks...');
  await vipService.expireStaleVip().catch(err => console.error('[Cron] expireStaleVip:', err.message));
  await vipService.notifyExpiringVip().catch(err => console.error('[Cron] notifyExpiringVip:', err.message));
});

// Daily midnight UTC: reset skip counts
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Resetting daily skip counts...');
  const db = require('./db/connection');
  await db('users')
    .update({ skip_count_today: 0, skip_reset_date: db.raw('CURRENT_DATE') })
    .catch(err => console.error('[Cron] skip reset:', err.message));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
