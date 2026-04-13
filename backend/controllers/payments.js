const axios = require('axios');
const crypto = require('crypto');
const db = require('../db/connection');
const { VIP_PLANS, activateVip } = require('../services/vip.js');

// ─── Telegram Stars ───────────────────────────────────────────────────────────

async function createStarsInvoice(req, res) {
  const { plan } = req.body;
  if (!VIP_PLANS[plan]) return res.status(400).json({ error: 'invalid_plan' });

  const vipPlan = VIP_PLANS[plan];
  const user = await db('users').where({ id: req.user.userId }).first();

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`,
      {
        title: vipPlan.label,
        description: `Unlock VIP benefits: priority matching, gender filter, unlimited skips.`,
        payload: JSON.stringify({ user_id: req.user.userId, plan }),
        currency: 'XTR',
        prices: [{ label: vipPlan.label, amount: vipPlan.stars }]
      }
    );

    const invoiceLink = response.data.result;

    await db('transactions').insert({
      user_id: req.user.userId,
      method: 'stars',
      vip_plan: plan,
      status: 'pending',
      external_ref: null
    });

    return res.json({ invoice_link: invoiceLink });
  } catch (err) {
    console.error('Stars invoice error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'invoice_creation_failed' });
  }
}

async function handleStarsWebhook(req, res) {
  const update = req.body;

  if (update.pre_checkout_query) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`,
      { pre_checkout_query_id: update.pre_checkout_query.id, ok: true }
    );
    return res.sendStatus(200);
  }

  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    let payload;
    try {
      payload = JSON.parse(payment.invoice_payload);
    } catch {
      return res.sendStatus(200);
    }

    const { user_id, plan } = payload;

    await db('transactions')
      .where({ user_id, method: 'stars', vip_plan: plan, status: 'pending' })
      .orderBy('created_at', 'desc')
      .limit(1)
      .update({
        status: 'success',
        external_ref: payment.telegram_payment_charge_id
      });

    await activateVip(user_id, plan);
    return res.sendStatus(200);
  }

  return res.sendStatus(200);
}

// ─── Midtrans QRIS ────────────────────────────────────────────────────────────

function midtransAuthHeader() {
  const key = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');
  return `Basic ${key}`;
}

const MIDTRANS_BASE = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

async function createQrisPayment(req, res) {
  const { plan } = req.body;
  if (!VIP_PLANS[plan]) return res.status(400).json({ error: 'invalid_plan' });

  const vipPlan = VIP_PLANS[plan];
  const user = await db('users').where({ id: req.user.userId }).first();
  const orderId = `vc-${req.user.userId.slice(0, 8)}-${Date.now()}`;

  try {
    const response = await axios.post(
      `${MIDTRANS_BASE}/transactions`,
      {
        transaction_details: { order_id: orderId, gross_amount: vipPlan.idr },
        customer_details: {
          first_name: user.first_name || 'User',
          email: `${user.telegram_id}@telegram.user`
        },
        enabled_payments: ['qris'],
        item_details: [{ id: plan, name: vipPlan.label, quantity: 1, price: vipPlan.idr }]
      },
      { headers: { Authorization: midtransAuthHeader(), 'Content-Type': 'application/json' } }
    );

    await db('transactions').insert({
      user_id: req.user.userId,
      method: 'qris',
      vip_plan: plan,
      status: 'pending',
      external_ref: orderId,
      amount_usd: null
    });

    return res.json({
      snap_token: response.data.token,
      redirect_url: response.data.redirect_url,
      order_id: orderId
    });
  } catch (err) {
    console.error('QRIS error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'payment_creation_failed' });
  }
}

async function handleMidtransWebhook(req, res) {
  const { order_id, transaction_status, fraud_status, signature_key, gross_amount, status_code } = req.body;

  // Verify Midtrans signature
  const expected = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');

  if (expected !== signature_key) {
    return res.status(403).json({ error: 'invalid_signature' });
  }

  const tx = await db('transactions').where({ external_ref: order_id }).first();
  if (!tx) return res.sendStatus(200);

  if (
    (transaction_status === 'capture' && fraud_status === 'accept') ||
    transaction_status === 'settlement'
  ) {
    await db('transactions').where({ id: tx.id }).update({ status: 'success' });
    await activateVip(tx.user_id, tx.vip_plan);
  } else if (['deny', 'cancel', 'expire', 'failure'].includes(transaction_status)) {
    await db('transactions').where({ id: tx.id }).update({ status: 'failed' });
  }

  return res.sendStatus(200);
}

module.exports = { createStarsInvoice, handleStarsWebhook, createQrisPayment, handleMidtransWebhook };
