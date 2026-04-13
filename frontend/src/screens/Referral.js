import { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Card, Screen, BottomNav, Spinner } from '../components/index.js';

export default function ReferralScreen({ onNavigate }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getReferrals().then(res => {
      if (!res.error) setData(res);
      setLoading(false);
    });
  }, []);

  function copyLink() {
    if (!data?.referral_link) return;
    navigator.clipboard?.writeText(data.referral_link)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        // Fallback for Telegram WebApp
        window.Telegram?.WebApp?.showAlert('Copy this link:\n' + data.referral_link);
      });
  }

  function shareLink() {
    const text = `Join VoiceMatch and talk to random people! ${data?.referral_link}`;
    window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(data?.referral_link)}&text=${encodeURIComponent('Join VoiceMatch!')}`);
  }

  return (
    <Screen>
      <div className="flex flex-col flex-1 px-5 pt-8 pb-24">

        <div className="mb-6">
          <h1 className="text-xl font-bold">Invite Friends</h1>
          <p className="text-muted text-sm mt-1">Earn 2 tokens for every valid referral</p>
        </div>

        {/* How it works */}
        <Card className="mb-5">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">How it works</p>
          <div className="flex flex-col gap-3">
            {[
              { step: '1', text: 'Share your unique invite link' },
              { step: '2', text: 'Friend joins and completes 2 tasks' },
              { step: '3', text: 'You receive 2 Gender Tokens automatically' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {item.step}
                </div>
                <p className="text-sm text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Total',       value: data?.total_referrals ?? 0 },
                { label: 'Valid',        value: data?.valid_referrals ?? 0 },
                { label: 'Tokens Earned', value: data?.tokens_earned ?? 0 },
              ].map(stat => (
                <Card key={stat.label} className="text-center py-4">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-muted text-xs mt-1">{stat.label}</div>
                </Card>
              ))}
            </div>

            {/* Link */}
            <Card className="mb-5">
              <p className="text-xs text-muted mb-2">Your invite link</p>
              <div className="flex items-center gap-2 bg-card rounded-xl px-3 py-2.5 border border-border">
                <p className="text-xs text-white flex-1 truncate font-mono">
                  {data?.referral_link || '—'}
                </p>
                <button
                  onClick={copyLink}
                  className="text-xs font-medium text-white bg-white/10 px-3 py-1.5 rounded-lg flex-shrink-0 active:scale-95 transition-all"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </Card>

            {/* Share button */}
            <button
              onClick={shareLink}
              className="w-full bg-white text-black font-medium py-4 rounded-xl text-base active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>✈️</span> Share via Telegram
            </button>

            {/* Recent referrals */}
            {data?.referrals?.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Recent Referrals</p>
                <div className="flex flex-col gap-2">
                  {data.referrals.slice(0, 5).map(ref => (
                    <div key={ref.id} className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3 border border-border">
                      <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-base">👤</div>
                      <div className="flex-1">
                        <p className="text-sm">{ref.first_name || ref.telegram_username || 'User'}</p>
                        <p className="text-xs text-muted">{new Date(ref.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-medium ${ref.is_valid ? 'text-success' : 'text-muted'}`}>
                        {ref.is_valid ? '+2 tokens' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav active="referral" onNavigate={onNavigate} />
    </Screen>
  );
}
