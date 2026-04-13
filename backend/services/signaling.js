const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const matchmaking = require('./matchmaking.js');

// Map<userId, WebSocket>
const clients = new Map();

// Map<sessionId, { user1Id, user2Id }>
const activeSessions = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendToUser(userId, data) {
  const ws = clients.get(userId);
  if (ws) send(ws, data);
}

/**
 * Attach signaling WebSocket server to an existing HTTP server.
 */
function attachSignalingServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId = null;

    const authTimeout = setTimeout(() => {
      if (!userId) ws.close(4001, 'Authentication timeout');
    }, 5000);

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return send(ws, { type: 'error', code: 'invalid_json' });
      }

      // ── AUTH ──────────────────────────────────────────────────────────────
      if (msg.type === 'auth') {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
          userId = payload.userId;

          const user = await db('users').where({ id: userId }).first();
          if (!user || user.is_banned) {
            return ws.close(4003, 'Banned or not found');
          }

          clearTimeout(authTimeout);
          clients.set(userId, ws);
          ws.userId = userId;

          send(ws, { type: 'authenticated', userId });
        } catch {
          ws.close(4001, 'Invalid token');
        }
        return;
      }

      if (!userId) return ws.close(4001, 'Not authenticated');

      // ── QUEUE_ENTER ───────────────────────────────────────────────────────
      if (msg.type === 'queue_enter') {
        const user = await db('users').where({ id: userId }).first();
        if (!user.gender) {
          return send(ws, { type: 'error', code: 'gender_not_set' });
        }

        try {
          await matchmaking.enterQueue({
            userId,
            gender: user.gender,
            isVip: user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date()),
            genderPreference: msg.gender_preference || 'any',
            useToken: !!msg.use_token,
            onMatch: (sessionId, peerId, role) => {
              activeSessions.set(sessionId, { user1Id: userId, user2Id: peerId });
              send(ws, {
                type: 'match_found',
                session_id: sessionId,
                role,
                peer_gender: null
              });
            },
            onTimeout: () => {
              send(ws, { type: 'queue_timeout' });
            }
          });

          send(ws, { type: 'queue_entered', queue_size: matchmaking.getQueueSize() });
        } catch (err) {
          send(ws, { type: 'error', code: err.code || 'queue_error', message: err.message });
        }
        return;
      }

      // ── QUEUE_LEAVE ───────────────────────────────────────────────────────
      if (msg.type === 'queue_leave') {
        await matchmaking.leaveQueue(userId, true);
        send(ws, { type: 'queue_left' });
        return;
      }

      // ── SIGNAL (offer / answer) ───────────────────────────────────────────
      if (msg.type === 'signal') {
        const session = await db('sessions').where({ id: msg.session_id }).first();
        if (!session) return send(ws, { type: 'error', code: 'session_not_found' });

        const peerId = session.user_1_id === userId ? session.user_2_id : session.user_1_id;
        sendToUser(peerId, {
          type: 'signal',
          session_id: msg.session_id,
          payload: msg.payload
        });
        return;
      }

      // ── ICE_CANDIDATE ─────────────────────────────────────────────────────
      if (msg.type === 'ice_candidate') {
        const session = await db('sessions').where({ id: msg.session_id }).first();
        if (!session) return;

        const peerId = session.user_1_id === userId ? session.user_2_id : session.user_1_id;
        sendToUser(peerId, {
          type: 'ice_candidate',
          session_id: msg.session_id,
          candidate: msg.candidate
        });
        return;
      }

      // ── CALL_CONNECTED ────────────────────────────────────────────────────
      if (msg.type === 'call_connected') {
        send(ws, { type: 'call_ready' });
        return;
      }

      // ── END_CALL ──────────────────────────────────────────────────────────
      if (msg.type === 'end_call') {
        const session = await db('sessions')
          .where({ id: msg.session_id, status: 'active' })
          .first();

        if (session) {
          await db('sessions').where({ id: session.id }).update({
            status: 'ended',
            end_reason: msg.reason || 'user_ended',
            ended_at: db.fn.now()
          });

          const peerId = session.user_1_id === userId ? session.user_2_id : session.user_1_id;
          sendToUser(peerId, {
            type: 'call_ended',
            reason: msg.reason || 'user_ended'
          });
        }

        send(ws, { type: 'call_ended', reason: msg.reason });
        return;
      }

      // ── REPORT ────────────────────────────────────────────────────────────
      if (msg.type === 'report_user') {
        const session = await db('sessions').where({ id: msg.session_id }).first();
        if (!session) return;

        const reportedId = session.user_1_id === userId ? session.user_2_id : session.user_1_id;

        await db('reports').insert({
          reporter_id: userId,
          reported_id: reportedId,
          session_id: msg.session_id,
          reason: msg.reason || 'other'
        });

        send(ws, { type: 'report_submitted' });
        return;
      }
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    ws.on('close', async () => {
      if (!userId) return;
      clients.delete(userId);
      await matchmaking.leaveQueue(userId, false);

      // Notify peer if in active session
      for (const [sessionId, s] of activeSessions.entries()) {
        if (s.user1Id === userId || s.user2Id === userId) {
          const peerId = s.user1Id === userId ? s.user2Id : s.user1Id;

          await db('sessions').where({ id: sessionId, status: 'active' }).update({
            status: 'ended',
            end_reason: 'disconnected',
            ended_at: db.fn.now()
          });

          sendToUser(peerId, { type: 'peer_disconnected', session_id: sessionId });
          activeSessions.delete(sessionId);
          break;
        }
      }
    });

    ws.on('error', (err) => console.error('WebSocket error:', err.message));
  });

  console.log('✅ WebSocket signaling server attached at /ws');
  return wss;
}

function isUserOnline(userId) {
  return clients.has(userId);
}

module.exports = { attachSignalingServer, sendToUser, isUserOnline };
