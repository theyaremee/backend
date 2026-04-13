# VoiceMatch — Telegram Mini App

Random 1-on-1 voice chat with gender filtering, VIP system, token economy, and referrals.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL (via Knex) |
| Realtime | WebSocket (ws) |
| Voice | WebRTC (peer-to-peer audio) |
| Auth | Telegram WebApp HMAC + JWT |
| Payments | Telegram Stars + Midtrans (QRIS) |
| Process | PM2 |

---

## Quick Setup (4 steps)

### Step 1 — Fill in environment variables

**Backend** — copy and edit:
```bash
cp backend/.env.example backend/.env
```

Required values:
```
TELEGRAM_BOT_TOKEN=     # From @BotFather
TELEGRAM_BOT_USERNAME=  # e.g. myvoicechatbot
DATABASE_URL=           # postgresql://user:pass@host:5432/voicechat
JWT_SECRET=             # Any long random string
TURN_SERVER_URL=        # turn:your-turn-server.com:3478
TURN_USERNAME=          # TURN credentials
TURN_PASSWORD=
MIDTRANS_SERVER_KEY=    # From Midtrans dashboard
MIDTRANS_CLIENT_KEY=
ADMIN_USERNAME=         # Admin panel credentials
ADMIN_PASSWORD=
```

**Frontend** — copy and edit:
```bash
cp frontend/.env.example frontend/.env.local
```

```
NEXT_PUBLIC_API_URL=    # https://your-backend.com/api
NEXT_PUBLIC_WS_URL=     # wss://your-backend.com/ws
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
```

### Step 2 — Run deploy script
```bash
chmod +x deploy.sh
./deploy.sh
```

This installs dependencies, runs DB migrations, seeds tasks, builds frontend, and starts PM2.

### Step 3 — Configure Telegram Bot

In @BotFather:
1. `/setmenubutton` → set URL to your frontend domain
2. `/setdomain` → whitelist your frontend domain
3. Set webhook for Stars payments:
```
https://your-backend.com/api/webhooks/telegram
```

### Step 4 — Set Midtrans webhook

In Midtrans dashboard → Configuration → Payment Notification URL:
```
https://your-backend.com/api/webhooks/midtrans
```

---

## Project Structure

```
voicechat-app/
├── backend/
│   ├── db/
│   │   ├── migrations/       # All DB schema migrations
│   │   └── seeds/            # Task seed data
│   ├── middleware/
│   │   ├── auth.js           # Telegram HMAC + JWT validation
│   │   ├── rateLimit.js      # Per-user rate limiting
│   │   └── admin.js          # Admin basic auth
│   ├── services/
│   │   ├── matchmaking.js    # In-memory queue + algorithm
│   │   ├── signaling.js      # WebSocket + WebRTC signaling
│   │   ├── token.js          # Atomic token operations
│   │   ├── vip.js            # VIP plans + expiry cron
│   │   └── notification.js   # Telegram bot messages
│   ├── controllers/
│   │   ├── auth.js           # Login + JWT issue
│   │   ├── users.js          # Profile + gender
│   │   ├── tasks.js          # Task list + claim
│   │   ├── referrals.js      # Referral stats
│   │   ├── payments.js       # Stars + QRIS payment
│   │   └── admin.js          # Admin CRUD
│   ├── routes/index.js       # All API routes
│   └── server.js             # Entry point + cron jobs
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── App.js        # Main orchestrator
│       │   ├── page.js       # Next.js entry
│       │   └── layout.js
│       ├── screens/
│       │   ├── LoadingScreen.js
│       │   ├── GenderSelect.js
│       │   ├── Home.js
│       │   ├── Matching.js
│       │   ├── Call.js
│       │   ├── Task.js
│       │   ├── Referral.js
│       │   ├── VIP.js
│       │   └── Profile.js
│       ├── hooks/
│       │   ├── useAuth.js    # Telegram login + user state
│       │   └── useWebRTC.js  # Full WebRTC peer connection
│       ├── services/
│       │   ├── api.js        # HTTP client + auto token refresh
│       │   └── socket.js     # WebSocket signaling client
│       ├── components/index.js  # Button, Card, Avatar, etc.
│       └── styles/globals.css
│
├── ecosystem.config.js       # PM2 config
├── deploy.sh                 # One-click deploy
└── README.md
```

---

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Telegram initData → JWT |
| POST | `/api/auth/refresh` | Refresh JWT via cookie |
| POST | `/api/webhooks/telegram` | Telegram Stars payment webhook |
| POST | `/api/webhooks/midtrans` | Midtrans QRIS payment webhook |
| GET  | `/api/vip/plans` | VIP plan list + pricing |

### Authenticated (Bearer JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | User profile |
| POST | `/api/me/gender` | Set gender |
| GET | `/api/tasks` | Task list with completion status |
| POST | `/api/tasks/claim` | Claim task reward |
| GET | `/api/referrals` | Referral stats + list |
| POST | `/api/payments/stars/invoice` | Create Stars invoice link |
| POST | `/api/payments/qris/create` | Create QRIS payment |

### Admin (HTTP Basic auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/reports` | Pending reports |
| POST | `/api/admin/reports/:id/action` | Review report |
| GET | `/api/admin/users/:id` | User details |
| POST | `/api/admin/users/:id/ban` | Ban user |
| POST | `/api/admin/users/:id/unban` | Unban user |
| POST | `/api/admin/users/:id/vip` | Grant VIP |
| POST | `/api/admin/users/:id/tokens` | Adjust tokens |

---

## WebSocket Messages

### Client → Server
```json
{ "type": "auth",        "token": "JWT" }
{ "type": "queue_enter", "gender_preference": "any|male|female", "use_token": false }
{ "type": "queue_leave" }
{ "type": "signal",      "session_id": "uuid", "payload": { "type": "offer|answer", "sdp": "..." } }
{ "type": "ice_candidate","session_id": "uuid", "candidate": { ... } }
{ "type": "end_call",    "session_id": "uuid", "reason": "user_ended|skipped" }
{ "type": "report_user", "session_id": "uuid", "reason": "harassment|spam|inappropriate|other" }
```

### Server → Client
```json
{ "type": "authenticated" }
{ "type": "queue_entered" }
{ "type": "match_found",  "session_id": "uuid", "role": "caller|callee", "peer_gender": "male|female" }
{ "type": "queue_timeout" }
{ "type": "signal",       "session_id": "uuid", "payload": { ... } }
{ "type": "ice_candidate","session_id": "uuid", "candidate": { ... } }
{ "type": "call_ended",   "reason": "..." }
{ "type": "peer_disconnected" }
```

---

## Notes

- **TURN server is mandatory.** ~15–20% of Indonesian mobile users are behind symmetric NAT. Without TURN, those calls will fail silently.
- **Token operations are atomic.** All token award/spend uses `SELECT FOR UPDATE` inside a transaction to prevent race conditions.
- **Gender token refunded on queue timeout.** If 60 seconds pass with no match and the user spent a token to filter gender, it is automatically refunded.
- **Admin panel is HTTP Basic auth only.** Never expose it without HTTPS.
