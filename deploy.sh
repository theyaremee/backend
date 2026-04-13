#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo "   VoiceMatch — Deploy Script"
echo "═══════════════════════════════════════"

# ── 1. Check .env files ────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found. Copying from .env.example..."
  cp backend/.env.example backend/.env
  echo "❌ Please fill in backend/.env then re-run this script."
  exit 1
fi

if [ ! -f frontend/.env.local ]; then
  echo "⚠️  frontend/.env.local not found. Copying from .env.example..."
  cp frontend/.env.example frontend/.env.local
  echo "❌ Please fill in frontend/.env.local then re-run this script."
  exit 1
fi

echo "✅ .env files found"

# ── 2. Install dependencies ────────────────────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm install --production && cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# ── 3. Run database migrations ────────────────────────────────────────────
echo ""
echo "🗄️  Running database migrations..."
cd backend && npx knex migrate:latest && cd ..

echo "🌱 Running seeds..."
cd backend && npx knex seed:run && cd ..

# ── 4. Build frontend ──────────────────────────────────────────────────────
echo ""
echo "🏗️  Building frontend..."
cd frontend && npm run build && cd ..

# ── 5. Start with PM2 ─────────────────────────────────────────────────────
echo ""
echo "🚀 Starting backend with PM2..."
npm install -g pm2 2>/dev/null || true
pm2 delete voicechat-backend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

echo ""
echo "═══════════════════════════════════════"
echo "✅ Deployment complete!"
echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: run 'cd frontend && npm start' or deploy to Vercel/Netlify"
echo ""
echo "PM2 commands:"
echo "  pm2 logs voicechat-backend   — view logs"
echo "  pm2 restart voicechat-backend — restart"
echo "  pm2 stop voicechat-backend    — stop"
echo "═══════════════════════════════════════"
