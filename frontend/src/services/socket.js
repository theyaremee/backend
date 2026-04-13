const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

class SignalingClient {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnects = 3;
    this._token = null;
  }

  connect(token) {
    this._token = token;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({ type: 'auth', token });
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (this.handlers[msg.type]) {
          this.handlers[msg.type](msg);
        }
      } catch {}
    };

    this.ws.onclose = (e) => {
      if (e.code === 4001 || e.code === 4003) return; // Auth failure — do not reconnect
      if (this.reconnectAttempts < this.maxReconnects) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        this.reconnectAttempts++;
        setTimeout(() => this.connect(this._token), delay);
      } else {
        this.handlers['connection_failed']?.();
      }
    };

    this.ws.onerror = () => {};
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type, handler) {
    this.handlers[type] = handler;
    return this;
  }

  off(type) {
    delete this.handlers[type];
    return this;
  }

  enterQueue(opts = {}) {
    this.send({
      type: 'queue_enter',
      gender_preference: opts.genderPreference || 'any',
      use_token: opts.useToken || false
    });
  }

  leaveQueue() {
    this.send({ type: 'queue_leave' });
  }

  sendOffer(sessionId, sdp) {
    this.send({ type: 'signal', session_id: sessionId, payload: { type: 'offer', sdp } });
  }

  sendAnswer(sessionId, sdp) {
    this.send({ type: 'signal', session_id: sessionId, payload: { type: 'answer', sdp } });
  }

  sendIceCandidate(sessionId, candidate) {
    this.send({ type: 'ice_candidate', session_id: sessionId, candidate });
  }

  endCall(sessionId, reason = 'user_ended') {
    this.send({ type: 'end_call', session_id: sessionId, reason });
  }

  skip(sessionId) {
    this.send({ type: 'end_call', session_id: sessionId, reason: 'skipped' });
  }

  reportUser(sessionId, reason) {
    this.send({ type: 'report_user', session_id: sessionId, reason });
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnects; // prevent auto-reconnect
    this.ws?.close();
    this.ws = null;
  }
}

// Singleton
const signalingClient = typeof window !== 'undefined' ? new SignalingClient() : null;
export default signalingClient;
