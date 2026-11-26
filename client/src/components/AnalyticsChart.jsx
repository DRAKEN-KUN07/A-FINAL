export function AnalyticsChart({ dailyTraffic = [] }) {
  const maxVal = Math.max(
    4,
    ...dailyTraffic.map((d) => Math.max(d.checkIns || 0, d.checkOuts || 0))
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, fontSize: '0.8rem', marginBottom: 14, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#0284c7' }} />
          Check-Ins
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }} />
          Check-Outs
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(dailyTraffic.length, 1)}, minmax(0, 1fr))`, gap: 10, alignItems: 'end', height: 170, paddingTop: 12 }}>
        {dailyTraffic.map((day) => {
          const inHeight = Math.round(((day.checkIns || 0) / maxVal) * 120);
          const outHeight = Math.round(((day.checkOuts || 0) / maxVal) * 120);
          return (
            <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 128 }}>
                <div
                  title={`${day.checkIns} check-ins`}
                  style={{
                    width: 14,
                    height: Math.max(4, inHeight),
                    background: '#0284c7',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <div
                  title={`${day.checkOuts} check-outs`}
                  style={{
                    width: 14,
                    height: Math.max(4, outHeight),
                    background: '#10b981',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {day.label?.split(',')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
