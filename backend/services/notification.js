const axios = require('axios');

const BOT_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const MINI_APP_URL = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`;

async function sendMessage(telegramId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: telegramId,
      text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await axios.post(`${BOT_API}/sendMessage`, payload, { timeout: 5000 });
  } catch (err) {
    console.error(`Notification failed for ${telegramId}:`, err.response?.data?.description || err.message);
  }
}

function openAppButton(label = 'Open App') {
  return {
    inline_keyboard: [[{
      text: label,
      web_app: { url: MINI_APP_URL }
    }]]
  };
}

async function notifyVipExpiringSoon(telegramId) {
  await sendMessage(
    telegramId,
    '⚡ <b>Your VIP expires in 24 hours.</b>\n\nRenew now to keep priority matching and gender selection.',
    openAppButton('Renew VIP')
  );
}

async function notifyVipExpired(telegramId) {
  await sendMessage(
    telegramId,
    '🔒 <b>Your VIP has expired.</b>\n\nYou\'ve been moved back to the free tier. Tap to renew.',
    openAppButton('Upgrade to VIP')
  );
}

async function notifyReferralReward(telegramId, tokens) {
  await sendMessage(
    telegramId,
    `🎁 <b>You earned ${tokens} token${tokens !== 1 ? 's' : ''}!</b>\n\nSomeone you referred just completed their tasks.`,
    openAppButton('View Tokens')
  );
}

async function notifyMatchWaiting(telegramId) {
  await sendMessage(
    telegramId,
    '🎙 <b>Someone is waiting for you!</b>\n\nTap to start your voice call now.',
    openAppButton('Join Call')
  );
}

module.exports = {
  notifyVipExpiringSoon,
  notifyVipExpired,
  notifyReferralReward,
  notifyMatchWaiting
};
