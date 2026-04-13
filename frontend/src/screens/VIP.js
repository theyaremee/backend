import { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Card, Screen, BottomNav, Badge, Spinner } from '../components/index.js';

const BENEFITS = [
  { icon: '⚡', text: 'Priority matching — skip the queue' },
  { icon: '🎯', text: 'Choose gender for every match' },
  { icon: '⏭',  text: 'Unlimited skips per day' },
  { icon: '🏅', text: 'VIP badge on your profile' },
  { icon: '🚫', text: 'No ads (when launched)' },
];

export default function VIPScreen({ user, onVipActivated, onNavigate }) {
  const [plans, setPlans]     = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('30d');
  const [paying, setPaying]   = useState(false);
  const [method, setMethod]   = useState('stars');

  const isVipActive = user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

  useEffect(() => {
    api.getVipPlans().then(data => {
      if (!data.error) setPlans(data.plans);
      setLoading(false);
    });
  }, []);

  async function handlePurchase() {
    if (paying) return;
    setPaying(true);

    try {
      if (method === 'stars') {
        const data = await api.createStarsInvoice(selected);
        if (data.invoice_link) {
          window.Telegram?.WebApp?.openInvoice(data.invoice_link, (status) => {
            if (status === 'paid') onVipActivated?.();
          });
        }
      } else {
        const data = await api.createQrisPayment(selected);
        if (data.redirect_url) {
          window.Telegram?.WebApp?.openLink(data.redirect_url);
        }
      }
    } catch {
      window.Telegram?.WebApp?.showAlert('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  const planLabels = { '7d': 'Weekly', '30d': 'Monthly', lifetime: 'Lifetime' };

  return (
    <Screen>
      <div className="flex flex-col flex-1 px-5 pt-8 pb-24 overflow-y-auto">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-2xl font-bold">VoiceMatch VIP</h1>
          <p className="text-muted text-sm mt-1">Unlock the full experience</p>
        </div>

        {/* Already VIP */}
        {isVipActive && (
          <Card className="mb-5 border-vip/30 bg-vip/10 text-center">
            <Badge variant="vip">Active VIP</Badge>
            <p className="text-sm text-muted mt-2">
              {user.vip_expires_at
                ? `Expires ${new Date(user.vip_expires_at).toLocaleDateString()}`
                : 'Lifetime — never expires'}
            </p>
          </Card>
        )}

        {/* Benefits */}
        <Card className="mb-5">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Benefits</p>
          <div className="flex flex-col gap-3">
            {BENEFITS.map(b => (
              <div key={b.text} className="flex items-center gap-3 text-sm">
                <span className="text-base w-6 text-center">{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </Card>

        {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
          <>
            {/* Plan selector */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {Object.entries(plans).map(([key, plan]) => (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex flex-col items-center gap-1 py-4 rounded-xl border transition-all ${
                    selected === key
                      ? 'bg-vip/20 border-vip text-vip'
                      : 'bg-surface border-border text-muted'
                  }`}
                >
                  {key === '30d' && (
                    <span className="text-xs bg-vip text-black px-2 py-0.5 rounded-full font-medium -mt-1 mb-1">
                      Best
                    </span>
                  )}
                  <span className="text-xs font-medium">{planLabels[key]}</span>
                  <span className="text-sm font-bold text-white">
                    {plans[key]?.stars} ⭐
                  </span>
                  <span className="text-xs text-muted">
                    Rp {plans[key]?.idr?.toLocaleString('id')}
                  </span>
                </button>
              ))}
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { id: 'stars', label: 'Telegram Stars', icon: '⭐' },
                { id: 'qris',  label: 'QRIS',           icon: '🇮🇩' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                    method === m.id ? 'bg-white/10 border-white/30 text-white' : 'bg-surface border-border text-muted'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span className="font-medium">{m.label}</span>
                </button>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handlePurchase}
              disabled={paying}
              className="w-full bg-vip text-black font-bold py-4 rounded-xl text-base active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {paying ? <Spinner size={20} /> : null}
              {paying ? 'Opening payment...' : `Upgrade — ${method === 'stars' ? `${plans[selected]?.stars} ⭐` : `Rp ${plans[selected]?.idr?.toLocaleString('id')}`}`}
            </button>

            <p className="text-center text-xs text-muted mt-3">
              Payments are processed securely via {method === 'stars' ? 'Telegram' : 'Midtrans'}.
            </p>
          </>
        )}
      </div>
      <BottomNav active="vip" onNavigate={onNavigate} />
    </Screen>
  );
}
