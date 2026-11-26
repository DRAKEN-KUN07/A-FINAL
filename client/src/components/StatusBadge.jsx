const TONE_MAP = {
  active: 'badge-sky',
  approved: 'badge-emerald',
  checked_in: 'badge-emerald',
  sent: 'badge-emerald',
  completed: 'badge-indigo',
  checked_out: 'badge-slate',
  pending: 'badge-amber',
  simulated: 'badge-sky',
  rejected: 'badge-rose',
  revoked: 'badge-rose',
  expired: 'badge-rose',
  failed: 'badge-rose',
  cancelled: 'badge-slate',
  admin: 'badge-indigo',
  security: 'badge-amber',
  employee: 'badge-sky',
  visitor: 'badge-emerald',
  check_in: 'badge-emerald',
  check_out: 'badge-slate',
  invite: 'badge-indigo',
  pre_registration: 'badge-sky',
  walk_in: 'badge-amber',
};

export function StatusBadge({ value }) {
  const key = String(value || 'unknown').toLowerCase();
  const cls = TONE_MAP[key] || 'badge-slate';
  return <span className={`badge ${cls}`}>{key.replace(/_/g, ' ')}</span>;
}
