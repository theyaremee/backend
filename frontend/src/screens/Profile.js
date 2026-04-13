import { Card, Badge, Screen, BottomNav } from '../components/index.js';

export default function ProfileScreen({ user, onNavigate }) {
  const isVipActive = user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <Screen>
      <div className="flex flex-col flex-1 px-5 pt-8 pb-24">

        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center text-4xl mb-3">
            {user.gender === 'female' ? '👩' : user.gender === 'male' ? '👨' : '👤'}
          </div>
          <h2 className="text-lg font-bold">{window?.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'User'}</h2>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={isVipActive ? 'vip' : 'default'}>
              {isVipActive ? '⚡ VIP' : 'Free'}
            </Badge>
            {user.gender && (
              <Badge variant="default">
                {user.gender === 'male' ? '👨 Male' : '👩 Female'}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="text-center">
            <div className="text-2xl font-bold">{user.token_balance}</div>
            <div className="text-muted text-xs mt-1">Tokens</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold">
              {isVipActive ? '∞' : `${Math.max(0, 5 - (user.skip_count_today || 0))}`}
            </div>
            <div className="text-muted text-xs mt-1">Skips left today</div>
          </Card>
        </div>

        {/* Account info */}
        <Card className="mb-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Account</p>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Status',       value: isVipActive ? 'VIP' : 'Free' },
              { label: 'VIP expires',  value: user.vip_expires_at ? formatDate(user.vip_expires_at) : isVipActive ? 'Never (Lifetime)' : '—' },
              { label: 'Referral code', value: user.referral_code },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-sm text-muted">{row.label}</span>
                <span className="text-sm font-medium font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onNavigate('vip')}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-left text-sm font-medium flex items-center gap-3 active:bg-card transition-colors"
          >
            <span>⚡</span>
            <span>{isVipActive ? 'Manage VIP' : 'Upgrade to VIP'}</span>
            <span className="ml-auto text-muted">›</span>
          </button>
          <button
            onClick={() => onNavigate('referral')}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-left text-sm font-medium flex items-center gap-3 active:bg-card transition-colors"
          >
            <span>🔗</span>
            <span>Invite friends & earn tokens</span>
            <span className="ml-auto text-muted">›</span>
          </button>
          <button
            onClick={() => onNavigate('tasks')}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-left text-sm font-medium flex items-center gap-3 active:bg-card transition-colors"
          >
            <span>✅</span>
            <span>Complete tasks</span>
            <span className="ml-auto text-muted">›</span>
          </button>
        </div>

        <p className="text-center text-xs text-muted/40 mt-6">
          VoiceMatch v1.0.0
        </p>
      </div>
      <BottomNav active="profile" onNavigate={onNavigate} />
    </Screen>
  );
}
