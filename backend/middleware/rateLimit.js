const rateLimit = require('express-rate-limit');

const byTelegramId = (req) => String(req.user?.telegram_id || req.ip);

const queueLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: byTelegramId,
  message: { error: 'too_many_requests' },
  standardHeaders: true,
  legacyHeaders: false
});

const taskLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: byTelegramId,
  message: { error: 'too_many_requests' }
});

const paymentLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: byTelegramId,
  message: { error: 'too_many_requests' }
});

const globalLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: byTelegramId,
  message: { error: 'too_many_requests' }
});

module.exports = { queueLimit, taskLimit, paymentLimit, globalLimit };
