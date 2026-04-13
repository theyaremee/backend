import { useState } from 'react';
import { Avatar, Timer, Screen } from '../components/index.js';

export default function CallScreen({
  peerGender,
  isMuted,
  callDuration,
  skipsRemaining,
  isVip,
  onMute,
  onSkip,
  onEnd,
  onReport,
  status = 'connecting'
}) {
  const [showReport, setShowReport] = useState(false);

  const statusLabel = {
    connecting: 'Connecting...',
    connected:  'Connected',
    reconnecting: 'Reconnecting...'
  }[status];

  const statusColor = {
    connecting:  'text-warning',
    connected:   'text-success',
    reconnecting:'text-warning'
  }[status];

  return (
    <Screen className="items-center justify-between px-6 py-10">

      {/* Top status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-success' : 'bg-warning'}`} />
        <span className={`text-sm ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Peer avatar */}
      <div className="flex flex-col items-center gap-6">
        <Avatar size={120} gender={peerGender} pulsing={status === 'connected'} />
        <div className="text-center">
          <div className="text-xl font-bold mb-1">
            {peerGender === 'male' ? 'Male' : peerGender === 'female' ? 'Female' : 'Unknown'}
          </div>
          {status === 'connected' && (
            <div className="text-muted text-sm">
              <Timer seconds={callDuration} />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full flex flex-col gap-4">

        {/* Primary controls */}
        <div className="flex justify-center gap-6">
          {/* Mute */}
          <button
            onClick={onMute}
            className={`w-16 h-16 rounded-full border transition-all active:scale-90 flex items-center justify-center text-2xl ${
              isMuted ? 'bg-danger/20 border-danger text-danger' : 'bg-surface border-border text-white'
            }`}
          >
            {isMuted ? '🔇' : '🎙'}
          </button>

          {/* End call */}
          <button
            onClick={onEnd}
            className="w-20 h-20 rounded-full bg-danger flex items-center justify-center text-3xl active:scale-90 transition-all shadow-lg"
          >
            📵
          </button>

          {/* Skip/Next */}
          <button
            onClick={() => {
              if (!isVip && skipsRemaining <= 0) return;
              onSkip();
            }}
            disabled={!isVip && skipsRemaining <= 0}
            className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-2xl active:scale-90 transition-all disabled:opacity-40"
          >
            ⏭
          </button>
        </div>

        {/* Skip indicator */}
        {!isVip && (
          <p className="text-center text-xs text-muted">
            {skipsRemaining > 0 ? `${skipsRemaining} skips remaining today` : 'No skips left today'}
          </p>
        )}

        {/* Report button */}
        <button
          onClick={() => setShowReport(true)}
          className="text-center text-xs text-muted/60 underline"
        >
          Report this user
        </button>
      </div>

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={() => setShowReport(false)}>
          <div className="bg-surface w-full rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Report User</h3>
            {['harassment', 'spam', 'inappropriate', 'other'].map(reason => (
              <button
                key={reason}
                onClick={() => { onReport(reason); setShowReport(false); }}
                className="w-full text-left py-3 border-b border-border text-sm capitalize text-muted hover:text-white transition-colors"
              >
                {reason}
              </button>
            ))}
            <button
              onClick={() => setShowReport(false)}
              className="w-full text-center py-3 text-danger text-sm mt-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}
