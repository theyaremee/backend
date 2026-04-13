import { useState, useEffect, useCallback } from 'react';
import { useAuth }    from '../hooks/useAuth.js';
import { useWebRTC }  from '../hooks/useWebRTC.js';
import signalingClient from '../services/socket.js';
import { getToken }    from '../services/api.js';

import LoadingScreen  from '../screens/LoadingScreen.js';
import GenderSelect   from '../screens/GenderSelect.js';
import HomeScreen     from '../screens/Home.js';
import MatchingScreen from '../screens/Matching.js';
import CallScreen     from '../screens/Call.js';
import TaskScreen     from '../screens/Task.js';
import ReferralScreen from '../screens/Referral.js';
import VIPScreen      from '../screens/VIP.js';
import ProfileScreen  from '../screens/Profile.js';

// App-level screens (not tabbed)
const FLOW_SCREENS = ['loading', 'gender_select', 'matching', 'call'];

export default function App() {
  const { user, loading, error, updateGender, refreshUser, setUser } = useAuth();

  const [screen, setScreen]         = useState('loading');
  const [tab, setTab]               = useState('home');
  const [callState, setCallState]   = useState({
    sessionId:    null,
    role:         null,
    peerGender:   null,
    status:       'connecting',
    skipsRemaining: 5,
  });

  // ── WebRTC callbacks ───────────────────────────────────────────────────────
  const { startAsCaller, startAsCallee, toggleMute, endCall, skip, isMuted, callDuration, cleanup } = useWebRTC({
    onConnected:    () => setCallState(s => ({ ...s, status: 'connected' })),
    onDisconnected: () => setCallState(s => ({ ...s, status: 'reconnecting' })),
    onError: (code) => {
      if (code === 'mic_denied') {
        window.Telegram?.WebApp?.showAlert('Microphone access is required for voice calls. Please allow it in your browser settings.');
      }
      setScreen('home');
    }
  });

  // ── Auth → screen routing ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading) { setScreen('loading'); return; }
    if (error)   { setScreen('error');   return; }
    if (!user)   { setScreen('loading'); return; }

    if (!user.gender) {
      setScreen('gender_select');
      return;
    }

    // Connect WebSocket after login
    if (signalingClient && !signalingClient.ws) {
      signalingClient.connect(getToken());
      setupSignalingHandlers();
    }

    if (!FLOW_SCREENS.includes(screen)) return; // preserve tab if already navigated
    setScreen('tab');
  }, [user, loading, error]);

  // ── Signaling event handlers ───────────────────────────────────────────────
  function setupSignalingHandlers() {
    signalingClient
      .on('match_found', async (msg) => {
        setCallState({
          sessionId:     msg.session_id,
          role:          msg.role,
          peerGender:    msg.peer_gender,
          status:        'connecting',
          skipsRemaining: 5
        });
        setScreen('call');

        // Small delay to let the call screen mount
        setTimeout(async () => {
          if (msg.role === 'caller') {
            await startAsCaller(msg.session_id);
          } else {
            await startAsCallee(msg.session_id);
          }
        }, 300);
      })
      .on('queue_timeout', () => {
        setScreen('tab');
        window.Telegram?.WebApp?.showAlert('No one found in 60 seconds. Try again!');
      })
      .on('call_ended', () => {
        cleanup();
        setScreen('tab');
      })
      .on('peer_disconnected', () => {
        setCallState(s => ({ ...s, status: 'reconnecting' }));
        setTimeout(() => {
          cleanup();
          setScreen('tab');
        }, 3000);
      })
      .on('connection_failed', () => {
        window.Telegram?.WebApp?.showAlert('Connection lost. Please restart the app.');
      });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleStartMatching({ genderPreference, useToken }) {
    setScreen('matching');
    signalingClient.enterQueue({ genderPreference, useToken });
  }

  function handleCancelMatching() {
    signalingClient.leaveQueue();
    setScreen('tab');
  }

  function handleEndCall() {
    endCall('user_ended');
    setScreen('tab');
  }

  function handleSkip() {
    skip();
    // Re-enter queue after skip
    setTimeout(() => {
      setScreen('matching');
      signalingClient.enterQueue({ genderPreference: 'any', useToken: false });
    }, 200);
  }

  function handleReport(reason) {
    if (callState.sessionId) {
      signalingClient.reportUser(callState.sessionId, reason);
    }
  }

  async function handleGenderSelect(gender) {
    await updateGender(gender);
    if (signalingClient && !signalingClient.ws) {
      signalingClient.connect(getToken());
      setupSignalingHandlers();
    }
    setScreen('tab');
  }

  function handleVipActivated() {
    refreshUser();
    setTab('home');
  }

  function handleTokensUpdated(newBalance) {
    setUser(prev => ({ ...prev, token_balance: newBalance }));
  }

  function navigate(destination) {
    setTab(destination);
    if (screen !== 'tab') setScreen('tab');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (screen === 'loading') return <LoadingScreen />;

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-bold">Could not connect</h2>
        <p className="text-muted text-sm">{error}</p>
        <p className="text-xs text-muted">Open this app from Telegram</p>
      </div>
    );
  }

  if (screen === 'gender_select') {
    return <GenderSelect onSelect={handleGenderSelect} />;
  }

  if (screen === 'matching') {
    return <MatchingScreen onCancel={handleCancelMatching} />;
  }

  if (screen === 'call') {
    return (
      <CallScreen
        peerGender={callState.peerGender}
        isMuted={isMuted}
        callDuration={callDuration}
        skipsRemaining={callState.skipsRemaining}
        isVip={user?.is_vip}
        status={callState.status}
        onMute={toggleMute}
        onSkip={handleSkip}
        onEnd={handleEndCall}
        onReport={handleReport}
      />
    );
  }

  // ── Tab screens ────────────────────────────────────────────────────────────
  if (!user) return <LoadingScreen />;

  const tabScreens = {
    home:     <HomeScreen     user={user} onStartMatching={handleStartMatching} onNavigate={navigate} />,
    tasks:    <TaskScreen     user={user} onTokensUpdated={handleTokensUpdated} onNavigate={navigate} />,
    referral: <ReferralScreen onNavigate={navigate} />,
    vip:      <VIPScreen      user={user} onVipActivated={handleVipActivated} onNavigate={navigate} />,
    profile:  <ProfileScreen  user={user} onNavigate={navigate} />,
  };

  return tabScreens[tab] || tabScreens.home;
}
