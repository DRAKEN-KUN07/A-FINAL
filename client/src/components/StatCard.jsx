export function StatCard({ label, value, hint, icon: Icon, accent = '#0284c7', bg = '#e0f2fe' }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' }}>
          {value ?? 0}
        </div>
        {hint && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>
        )}
      </div>
      {Icon && (
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: bg,
            color: accent,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={22} />
        </div>
      )}
    </div>
  );
}
