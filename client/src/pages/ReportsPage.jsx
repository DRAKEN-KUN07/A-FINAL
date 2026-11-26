import { useCallback, useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/StatusBadge';

export function ReportsPage() {
  const { addToast } = useToast();

  const [type, setType] = useState('passes');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/reports', {
        params: {
          type,
          status: status !== 'all' ? status : undefined,
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setRows(res.data.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [type, status, search, from, to, addToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExport = async (format) => {
    try {
      const res = await api.get('/dashboard/export', {
        params: {
          type,
          format,
          status: status !== 'all' ? status : undefined,
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gatepass-${type}-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast(`Exported ${type} report as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Reports & Compliance Exports</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Search and filter across Passes, Check-In/Out Logs, and Appointments, then export CSV or JSON.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => handleExport('csv')}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => handleExport('json')}>
            <Download size={16} /> Export JSON
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <select
            className="select"
            style={{ width: 160 }}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setStatus('all');
            }}
          >
            <option value="passes">Visitor Passes</option>
            <option value="checklogs">Check-In / Out Logs</option>
            <option value="appointments">Appointments</option>
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitor, company, pass code, or gate..."
            />
          </div>

          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {type === 'checklogs' ? (
              <>
                <option value="check_in">Check In</option>
                <option value="check_out">Check Out</option>
              </>
            ) : type === 'appointments' ? (
              <>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </>
            ) : (
              <>
                <option value="active">Active</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="revoked">Revoked</option>
              </>
            )}
          </select>

          <input type="date" className="input" style={{ width: 155 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" className="input" style={{ width: 155 }} value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Generating report...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No records match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code / Ref</th>
                  <th>Visitor</th>
                  <th>Host / Gate</th>
                  <th>Timestamp / Window</th>
                  <th>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {type === 'checklogs'
                        ? row.pass?.passCode
                        : type === 'appointments'
                        ? row.appointmentCode
                        : row.passCode}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.visitor?.fullName}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{row.visitor?.company}</div>
                    </td>
                    <td>
                      <div>{row.host?.name || 'Reception'}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {row.gate || row.locationName || row.locationCode}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {type === 'checklogs'
                        ? new Date(row.timestamp).toLocaleString()
                        : type === 'appointments'
                        ? new Date(row.scheduledDate).toLocaleString()
                        : `${new Date(row.validFrom).toLocaleDateString()} — ${new Date(row.validUntil).toLocaleDateString()}`}
                    </td>
                    <td>
                      <StatusBadge value={type === 'checklogs' ? row.action : row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
