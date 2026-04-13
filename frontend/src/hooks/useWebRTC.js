import { useRef, useState, useCallback } from 'react';
import signalingClient from '../services/socket.js';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: process.env.NEXT_PUBLIC_TURN_URL     || '',
      username: process.env.NEXT_PUBLIC_TURN_USER || '',
      credential: process.env.NEXT_PUBLIC_TURN_PASS || ''
    }
  ].filter(s => s.urls)
};

const OFFER_TIMEOUT_MS = 8000;
const ICE_TIMEOUT_MS   = 10000;

export function useWebRTC({ onConnected, onDisconnected, onError }) {
  const pcRef       = useRef(null);
  const streamRef   = useRef(null);
  const sessionRef  = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef    = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && sessionRef.current) {
        signalingClient.sendIceCandidate(sessionRef.current, candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        signalingClient.send({ type: 'call_connected', session_id: sessionRef.current });
        startTimer();
        onConnected?.();
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
        onDisconnected?.();
      }
    };

    return pc;
  }, [cleanup, startTimer, onConnected, onDisconnected]);

  /**
   * Caller side: get mic, create offer, set up signaling handlers.
   */
  const startAsCaller = useCallback(async (sessionId) => {
    sessionRef.current = sessionId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Wait for answer from signaling
      const answerTimeout = setTimeout(() => {
        cleanup();
        onError?.('offer_timeout');
      }, OFFER_TIMEOUT_MS);

      signalingClient.on('signal', async (msg) => {
        if (msg.payload.type === 'answer') {
          clearTimeout(answerTimeout);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }
      });

      signalingClient.on('ice_candidate', async (msg) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signalingClient.sendOffer(sessionId, offer);

    } catch (err) {
      cleanup();
      onError?.(err.name === 'NotAllowedError' ? 'mic_denied' : 'webrtc_error');
    }
  }, [createPeerConnection, cleanup, onError]);

  /**
   * Callee side: get mic, receive offer, send answer.
   */
  const startAsCallee = useCallback(async (sessionId) => {
    sessionRef.current = sessionId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      signalingClient.on('ice_candidate', async (msg) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      });

      signalingClient.on('signal', async (msg) => {
        if (msg.payload.type === 'offer') {
          const iceTimeout = setTimeout(async () => {
            // Fallback: ICE stalled, try anyway
          }, ICE_TIMEOUT_MS);

          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalingClient.sendAnswer(sessionId, answer);
          clearTimeout(iceTimeout);
        }
      });

    } catch (err) {
      cleanup();
      onError?.(err.name === 'NotAllowedError' ? 'mic_denied' : 'webrtc_error');
    }
  }, [createPeerConnection, cleanup, onError]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const endCall = useCallback((reason = 'user_ended') => {
    if (sessionRef.current) {
      signalingClient.endCall(sessionRef.current, reason);
    }
    cleanup();
  }, [cleanup]);

  const skip = useCallback(() => {
    if (sessionRef.current) {
      signalingClient.skip(sessionRef.current);
    }
    cleanup();
  }, [cleanup]);

  return { startAsCaller, startAsCallee, toggleMute, endCall, skip, isMuted, callDuration, cleanup };
}
