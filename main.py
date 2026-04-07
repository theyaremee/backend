"""
backend/main.py — Backend FastAPI + Midtrans Snap Production
============================================================
Handles:
  - POST /api/invoice/create     → Buat transaksi Midtrans Snap
  - POST /api/webhook/midtrans   → Terima notifikasi dari Midtrans
  - GET  /api/invoice/{id}/status → Cek status invoice
  - POST /api/notify             → Terima notifikasi dari bot (opsional)
  - GET  /                       → Health check
"""

import os
import hmac
import hashlib
import httpx
import json
import sqlite3
import base64
import logging
import random
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────
# KONFIGURASI
# ─────────────────────────────────────────────────────────────

MIDTRANS_SERVER_KEY    = os.getenv("MIDTRANS_SERVER_KEY", "")
MIDTRANS_CLIENT_KEY    = os.getenv("MIDTRANS_CLIENT_KEY", "")
MIDTRANS_IS_PRODUCTION = os.getenv("MIDTRANS_IS_PRODUCTION", "true").lower() == "true"
BACKEND_API_KEY        = os.getenv("BACKEND_API_KEY", "")
BOT_WEBHOOK_URL        = os.getenv("BOT_WEBHOOK_URL", "")
DATABASE_PATH          = os.getenv("DATABASE_PATH", "data/backend.db")
MERCHANT_NAME          = os.getenv("MERCHANT_NAME", "Andik Digital Store")
PAYMENT_FINISH_URL     = os.getenv("PAYMENT_FINISH_URL", "https://t.me/andikdistoreid_bot")

MIDTRANS_SNAP_URL = (
    "https://app.midtrans.com/snap/v1/transactions"
    if MIDTRANS_IS_PRODUCTION
    else "https://app.sandbox.midtrans.com/snap/v1/transactions"
)

FEE_SMALL     = int(os.getenv("FEE_SMALL", "4000"))
FEE_LARGE     = int(os.getenv("FEE_LARGE", "5000"))
FEE_THRESHOLD = int(os.getenv("FEE_THRESHOLD", "50000"))

BOT_PRICES = {
    "whatsapp": int(os.getenv("PRICE_BOT_WHATSAPP", "100000")),
    "telegram": int(os.getenv("PRICE_BOT_TELEGRAM", "150000")),
}
AI_PRICES = {
    "20_chat":  {"price": int(os.getenv("PRICE_AI_20",  "5000")),  "limit": 20},
    "40_chat":  {"price": int(os.getenv("PRICE_AI_40",  "10000")), "limit": 40},
    "100_chat": {"price": int(os.getenv("PRICE_AI_100", "20000")), "limit": 100},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("backend")

app = FastAPI(title="Andik Digital Store Backend", version="2.0.0")


# ─────────────────────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────────────────────

def get_db():
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS orders (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id   TEXT UNIQUE NOT NULL,
                user_id      INTEGER NOT NULL,
                type         TEXT NOT NULL,
                product      TEXT,
                package      TEXT,
                coin         TEXT,
                wallet       TEXT,
                amount       INTEGER NOT NULL,
                gross_amount INTEGER NOT NULL,
                status       TEXT DEFAULT 'pending',
                snap_token   TEXT,
                payment_url  TEXT,
                expires_at   TEXT,
                created_at   TEXT DEFAULT (datetime('now','localtime')),
                paid_at      TEXT
            );
        """)


init_db()


# ─────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="API key tidak valid")
    return x_api_key


# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def midtrans_auth_header() -> dict:
    token = base64.b64encode(f"{MIDTRANS_SERVER_KEY}:".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }


def calc_fee(amount: int) -> int:
    return FEE_SMALL if amount <= FEE_THRESHOLD else FEE_LARGE


def generate_invoice_id() -> str:
    ts     = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"INV-{ts}-{suffix}"


def format_idr(amount: int) -> str:
    return f"Rp {amount:,}".replace(",", ".")


async def create_snap_token(
    order_id: str,
    gross_amount: int,
    user_id: int,
    item_name: str,
    product_type: str,
) -> dict:
    expires_at = (datetime.now() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S +0700")
    payload = {
        "transaction_details": {
            "order_id":     order_id,
            "gross_amount": gross_amount,
        },
        "item_details": [
            {
                "id":       product_type,
                "price":    gross_amount,
                "quantity": 1,
                "name":     item_name[:50],
            }
        ],
        "customer_details": {
            "email": f"user{user_id}@andikdigital.id",
        },
        "expiry": {
            "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S +0700"),
            "unit":       "hours",
            "duration":   24,
        },
        "callbacks": {
            "finish": PAYMENT_FINISH_URL,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            MIDTRANS_SNAP_URL,
            headers=midtrans_auth_header(),
            json=payload,
        )
        if resp.status_code not in (200, 201):
            log.error(f"Midtrans Snap error {resp.status_code}: {resp.text}")
            raise HTTPException(502, f"Midtrans error: {resp.text}")
        data = resp.json()
        return {
            "snap_token":  data["token"],
            "payment_url": data["redirect_url"],
            "expires_at":  expires_at,
        }


# ─────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {
        "status":       "ok",
        "service":      "Andik Digital Store Backend",
        "midtrans_mode": "production" if MIDTRANS_IS_PRODUCTION else "sandbox",
    }


class InvoiceRequest(BaseModel):
    type:    str
    user_id: int
    coin:    Optional[str] = None
    amount:  Optional[int] = None
    wallet:  Optional[str] = None
    product: Optional[str] = None
    package: Optional[str] = None


@app.post("/api/invoice/create")
async def create_invoice(req: InvoiceRequest, _=Depends(verify_api_key)):
    invoice_id   = generate_invoice_id()
    product_type = req.type
    item_name    = ""
    amount       = 0
    gross_amount = 0
    extra        = {}

    if product_type == "crypto":
        if not req.amount or not req.coin or not req.wallet:
            raise HTTPException(400, "coin, amount, wallet wajib untuk tipe crypto")
        amount       = req.amount
        gross_amount = amount + calc_fee(amount)
        item_name    = f"Top Up Crypto {req.coin} - {format_idr(amount)}"
        extra        = {"coin": req.coin, "wallet": req.wallet}

    elif product_type == "bot":
        if not req.product or req.product not in BOT_PRICES:
            raise HTTPException(400, f"Produk bot tidak dikenal: {req.product}")
        amount       = BOT_PRICES[req.product]
        gross_amount = amount
        names        = {"whatsapp": "Bot WhatsApp", "telegram": "Bot Telegram"}
        item_name    = names.get(req.product, req.product)
        extra        = {"product": req.product}

    elif product_type == "ai_agent":
        if not req.package or req.package not in AI_PRICES:
            raise HTTPException(400, f"Paket AI tidak dikenal: {req.package}")
        pkg          = AI_PRICES[req.package]
        amount       = pkg["price"]
        gross_amount = amount
        item_name    = f"AI Agent - {req.package.replace('_', ' ').title()}"
        extra        = {"package": req.package}

    else:
        raise HTTPException(400, f"Tipe produk tidak dikenal: {product_type}")

    try:
        snap = await create_snap_token(invoice_id, gross_amount, req.user_id, item_name, product_type)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Gagal panggil Midtrans")
        raise HTTPException(502, f"Gagal koneksi ke Midtrans: {e}")

    with get_db() as conn:
        conn.execute(
            """INSERT INTO orders
               (invoice_id, user_id, type, product, package, coin, wallet,
                amount, gross_amount, snap_token, payment_url, expires_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                invoice_id, req.user_id, product_type,
                extra.get("product"), extra.get("package"),
                extra.get("coin"),    extra.get("wallet"),
                amount, gross_amount,
                snap["snap_token"], snap["payment_url"], snap["expires_at"],
            )
        )

    log.info(f"Invoice dibuat: {invoice_id} | user={req.user_id} | type={product_type} | gross={gross_amount}")
    return {
        "invoice_id":  invoice_id,
        "payment_url": snap["payment_url"],
        "snap_token":  snap["snap_token"],
        "amount":      gross_amount,
        "expires_at":  snap["expires_at"],
    }


@app.get("/api/invoice/{invoice_id}/status")
async def get_invoice_status(invoice_id: str, _=Depends(verify_api_key)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM orders WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()

    if not row:
        raise HTTPException(404, "Invoice tidak ditemukan")

    return {
        "invoice_id": invoice_id,
        "status":     row["status"],
        "type":       row["type"],
        "amount":     row["gross_amount"],
        "created_at": row["created_at"],
        "paid_at":    row["paid_at"],
    }


# ─────────────────────────────────────────────────────────────
# WEBHOOK MIDTRANS — endpoint wajib didaftarkan di dashboard Midtrans
# ─────────────────────────────────────────────────────────────

@app.post("/api/webhook/midtrans")
async def midtrans_webhook(request: Request):
    body = await request.body()
    try:
        data = json.loads(body)
    except Exception:
        raise HTTPException(400, "Bad JSON")

    order_id           = data.get("order_id", "")
    status_code        = data.get("status_code", "")
    gross_amount_str   = data.get("gross_amount", "0")
    transaction_status = data.get("transaction_status", "")
    fraud_status       = data.get("fraud_status", "accept")
    signature_key      = data.get("signature_key", "")

    # Validasi signature SHA512
    raw_sig  = f"{order_id}{status_code}{gross_amount_str}{MIDTRANS_SERVER_KEY}"
    expected = hashlib.sha512(raw_sig.encode()).hexdigest()
    if not hmac.compare_digest(signature_key, expected):
        log.warning(f"Signature tidak valid untuk order {order_id}")
        raise HTTPException(403, "Signature tidak valid")

    log.info(f"Webhook: order={order_id} status={transaction_status} fraud={fraud_status}")

    is_paid = (
        transaction_status in ("capture", "settlement") and
        fraud_status == "accept"
    )
    is_failed = transaction_status in ("cancel", "deny", "expire")

    if not is_paid and not is_failed:
        return {"status": "ok", "action": "ignored"}

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM orders WHERE invoice_id = ?", (order_id,)
        ).fetchone()

    if not row:
        log.warning(f"Order {order_id} tidak ada di DB")
        return {"status": "ok", "action": "not_found"}

    if row["status"] == "paid":
        return {"status": "ok", "action": "already_processed"}

    new_status = "paid" if is_paid else "failed"
    with get_db() as conn:
        conn.execute(
            "UPDATE orders SET status=?, paid_at=datetime('now','localtime') WHERE invoice_id=?",
            (new_status, order_id)
        )

    if is_paid:
        await distribute_product(order_id, dict(row))
    else:
        await notify_bot_webhook({
            "invoice_id": order_id,
            "user_id":    row["user_id"],
            "type":       row["type"],
            "status":     "failed",
            "signature":  sign_payload(order_id, row["user_id"]),
        })

    return {"status": "ok", "action": "processed"}


# ─────────────────────────────────────────────────────────────
# DISTRIBUSI PRODUK OTOMATIS
# ─────────────────────────────────────────────────────────────

async def distribute_product(order_id: str, order: dict):
    product_type = order["type"]
    user_id      = order["user_id"]
    log.info(f"Distribusi: {product_type} → user {user_id}")

    payload = {
        "invoice_id": order_id,
        "user_id":    user_id,
        "type":       product_type,
        "status":     "success",
        "signature":  sign_payload(order_id, user_id),
    }

    if product_type == "ai_agent":
        pkg_key = order.get("package", "")
        if pkg_key in AI_PRICES:
            payload["package"] = pkg_key
            payload["limit"]   = AI_PRICES[pkg_key]["limit"]

    elif product_type == "crypto":
        payload["coin"]   = order.get("coin", "")
        payload["wallet"] = order.get("wallet", "")
        payload["amount"] = order.get("amount", 0)
        # TODO: integrasikan API exchange crypto di sini
        # Untuk sekarang admin notif via bot

    elif product_type == "bot":
        payload["product"] = order.get("product", "")

    await notify_bot_webhook(payload)


def sign_payload(invoice_id: str, user_id: int) -> str:
    raw = f"{invoice_id}{user_id}{BACKEND_API_KEY}"
    return hmac.new(BACKEND_API_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()


async def notify_bot_webhook(payload: dict):
    if not BOT_WEBHOOK_URL:
        log.warning("BOT_WEBHOOK_URL kosong — skip notifikasi bot")
        return
    body = json.dumps(payload, sort_keys=True).encode()
    sig  = hmac.new(BACKEND_API_KEY.encode(), body, hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                BOT_WEBHOOK_URL,
                content=body,
                headers={"X-Signature": sig, "Content-Type": "application/json"},
            )
            log.info(f"Notif bot → {resp.status_code}")
    except Exception as e:
        log.error(f"Gagal kirim ke bot: {e}")


@app.post("/api/notify")
async def receive_notify(request: Request, _=Depends(verify_api_key)):
    data = await request.json()
    log.info(f"Notif dari bot: {data}")
    return {"status": "ok"}
