// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', disabled, className = '', size = 'md' }) {
  const base = 'font-medium rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  const sizes = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3.5 text-base', lg: 'w-full py-4 text-base' };
  const variants = {
    primary:  'bg-white text-black hover:bg-gray-100',
    ghost:    'bg-transparent text-white border border-border hover:bg-surface',
    danger:   'bg-danger text-white hover:bg-red-600',
    success:  'bg-success text-white hover:bg-green-600',
    vip:      'bg-vip text-black hover:bg-yellow-400',
    surface:  'bg-surface text-white hover:bg-card',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-surface rounded-2xl border border-border p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ size = 80, gender, pulsing = false }) {
  const emoji = gender === 'female' ? '👩' : gender === 'male' ? '👨' : '🎙';
  return (
    <div className="relative flex items-center justify-center">
      {pulsing && (
        <>
          <div className="absolute rounded-full bg-white/10 animate-pulse-ring" style={{ width: size + 40, height: size + 40 }} />
          <div className="absolute rounded-full bg-white/5  animate-pulse-ring" style={{ width: size + 70, height: size + 70, animationDelay: '0.5s' }} />
        </>
      )}
      <div
        className="rounded-full bg-card flex items-center justify-center border border-border z-10"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {emoji}
      </div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-surface text-muted border-border',
    vip:     'bg-vip/20 text-vip border-vip/30',
    success: 'bg-success/20 text-success border-success/30',
    danger:  'bg-danger/20 text-danger border-danger/30',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${variants[variant]}`}>
      {children}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div
      className="rounded-full border-2 border-white/20 border-t-white animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
export function BottomNav({ active, onNavigate }) {
  const tabs = [
    { id: 'home',     label: 'Home',    icon: '🏠' },
    { id: 'tasks',    label: 'Tasks',   icon: '✅' },
    { id: 'referral', label: 'Invite',  icon: '🔗' },
    { id: 'vip',      label: 'VIP',     icon: '⚡' },
    { id: 'profile',  label: 'Profile', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-50">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
            active === tab.id ? 'text-white' : 'text-muted'
          }`}
        >
          <span className="text-base leading-none">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Screen wrapper ───────────────────────────────────────────────────────────
export function Screen({ children, className = '' }) {
  return (
    <div className={`min-h-screen bg-bg text-white flex flex-col ${className}`}>
      {children}
    </div>
  );
}

// ─── Timer display ────────────────────────────────────────────────────────────
export function Timer({ seconds }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return <span className="font-mono tabular-nums">{m}:{s}</span>;
}
