import { useState } from 'react';
import { Button, Card, Badge, Screen, BottomNav } from '../components/index.js';

export default function HomeScreen({ user, onStartMatching, onNavigate }) {
  const [showGenderChoice, setShowGenderChoice] = useState(false);
  const [genderPref, setGenderPref]             = useState('any');
  const [useToken, setUseToken]                 = useState(false);

  const isVipActive = user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

  function handleStart() {
    if (!isVipActive && user.token_balance > 0 && !showGenderChoice) {
      setShowGenderChoice(true);
      return;
    }
    if (isVipActive && !showGenderChoice) {
      setShowGenderChoice(true);
      return;
    }
    onStartMatching({ genderPreference: genderPref, useToken: !isVipActive && useToken });
    setShowGenderChoice(false);
  }

  return (
    <Screen>
      <div className="flex flex-col flex-1 px-5 pt-8 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold">VoiceMatch</h1>
            <p className="text-muted text-sm">Find someone to talk to</p>
          </div>
          <Badge variant={isVipActive ? 'vip' : 'default'}>
            {isVipActive ? '⚡ VIP' : 'Free'}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Card className="text-center">
            <div className="text-2xl font-bold">{user.token_balance}</div>
            <div className="text-muted text-xs mt-1">Tokens</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold">
              {isVipActive ? '∞' : Math.max(0, 5 - (user.skip_count_today || 0))}
            </div>
            <div className="text-muted text-xs mt-1">Skips left</div>
          </Card>
        </div>

        {/* Gender preference picker - VIP or token */}
        {showGenderChoice && (
          <Card className="mb-6 animate-fade-in">
            <p className="text-sm text-muted mb-3">Who do you want to talk to?</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: 'any',    label: 'Anyone', emoji: '🎲' },
                { id: 'male',   label: 'Male',   emoji: '👨' },
                { id: 'female', label: 'Female', emoji: '👩' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setGenderPref(opt.id);
                    if (!isVipActive) setUseToken(opt.id !== 'any');
                  }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs transition-all ${
                    genderPref === opt.id ? 'bg-white text-black border-white' : 'bg-card text-muted border-border'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            {!isVipActive && genderPref !== 'any' && (
              <p className="text-xs text-warning text-center">
                Uses 1 token ({user.token_balance} available)
              </p>
            )}
          </Card>
        )}

        {/* Main CTA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="w-32 h-32 rounded-full bg-surface border border-border flex items-center justify-center text-5xl">
            🎙
          </div>

          <div className="w-full flex flex-col gap-3">
            {!showGenderChoice ? (
              <Button variant="primary" size="lg" onClick={handleStart}>
                Start Matching
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStart}
                  disabled={!isVipActive && useToken && user.token_balance < 1}
                >
                  {useToken ? `Find ${genderPref === 'any' ? 'Anyone' : genderPref === 'male' ? 'Male' : 'Female'} (−1 token)` : 'Start Matching'}
                </Button>
                <Button variant="ghost" size="md" onClick={() => setShowGenderChoice(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Upgrade nudge for free users */}
        {!isVipActive && (
          <button
            onClick={() => onNavigate('vip')}
            className="mt-4 text-center text-xs text-vip underline"
          >
            Upgrade to VIP for priority matching & unlimited gender filter
          </button>
        )}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </Screen>
  );
}
