import { Appointment } from '../models/Appointment.js';
import { CheckLog } from '../models/CheckLog.js';
import { Pass } from '../models/Pass.js';
import { Visitor } from '../models/Visitor.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';

function toLocalDateKey(dateValue) {
  const d = new Date(dateValue);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildScopeFilters(req) {
  const { organizationId } = req.query;
  const baseFilter = {};
  if (req.user.role === 'employee') {
    baseFilter.host = req.user._id;
  } else if (req.user.role !== 'visitor') {
    const orgId = resolveOrganizationScope(req, organizationId);
    if (orgId) baseFilter.organization = orgId;
  }
  return baseFilter;
}

export const getDashboardStats = asyncHandler(async (req, res) => {
  if (req.user.role === 'visitor') {
    const visitorIds = await Visitor.find({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).distinct('_id');

    const [myAppointments, myPasses] = await Promise.all([
      Appointment.find({ visitor: { $in: visitorIds } })
        .populate('host', 'name department')
        .populate('organization', 'name code')
        .sort({ scheduledDate: -1 })
        .limit(10),
      Pass.find({ visitor: { $in: visitorIds } })
        .populate('host', 'name department')
        .populate('organization', 'name code')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    return res.json({
      success: true,
      data: {
        role: 'visitor',
        totals: {
          totalAppointments: myAppointments.length,
          pendingAppointments: myAppointments.filter((a) => a.status === 'pending').length,
          activePasses: myPasses.filter((p) => ['active', 'checked_in'].includes(p.status)).length,
          checkedInNow: myPasses.filter((p) => p.status === 'checked_in').length,
        },
        myAppointments,
        myPasses,
      },
    });
  }

  const scope = buildScopeFilters(req);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const visitorScope = scope.organization ? { organization: scope.organization } : {};

  const [
    totalVisitors,
    activePasses,
    currentlyCheckedIn,
    pendingAppointments,
    todayCheckIns,
    totalCheckLogs,
    recentLogs,
    pendingList,
    weeklyLogs,
    allPassesForBreakdown,
  ] = await Promise.all([
    Visitor.countDocuments(visitorScope),
    Pass.countDocuments({ ...scope, status: { $in: ['active', 'checked_in'] } }),
    Pass.countDocuments({ ...scope, status: 'checked_in' }),
    Appointment.countDocuments({ ...scope, status: 'pending' }),
    CheckLog.countDocuments({ ...scope, action: 'check_in', timestamp: { $gte: startOfToday } }),
    CheckLog.countDocuments(scope),
    CheckLog.find(scope)
      .populate('visitor', 'fullName company photoUrl')
      .populate('pass', 'passCode locationName')
      .populate('scannedBy', 'name')
      .sort({ timestamp: -1 })
      .limit(8),
    Appointment.find({ ...scope, status: 'pending' })
      .populate('visitor', 'fullName company email photoUrl')
      .populate('host', 'name department')
      .sort({ scheduledDate: 1 })
      .limit(6),
    CheckLog.find({ ...scope, timestamp: { $gte: sevenDaysAgo } }).select('action timestamp locationCode'),
    Pass.find(scope).select('status locationCode locationName'),
  ]);

  // Build 7-day traffic series
  const dayBuckets = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = toLocalDateKey(d);
    dayBuckets.set(key, {
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      checkIns: 0,
      checkOuts: 0,
    });
  }
  for (const log of weeklyLogs) {
    const key = toLocalDateKey(log.timestamp);
    const bucket = dayBuckets.get(key);
    if (bucket) {
      if (log.action === 'check_in') bucket.checkIns += 1;
      else bucket.checkOuts += 1;
    }
  }

  // Status & location breakdown
  const statusCounts = {};
  const locationCounts = {};
  for (const p of allPassesForBreakdown) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    const locKey = p.locationCode || 'MAIN-GATE';
    locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;
  }

  res.json({
    success: true,
    data: {
      role: req.user.role,
      totals: {
        totalVisitors,
        activePasses,
        currentlyCheckedIn,
        pendingAppointments,
        todayCheckIns,
        totalCheckLogs,
      },
      dailyTraffic: Array.from(dayBuckets.values()),
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      locationBreakdown: Object.entries(locationCounts).map(([locationCode, count]) => ({
        locationCode,
        count,
      })),
      recentCheckLogs: recentLogs,
      pendingApprovals: pendingList,
    },
  });
});

async function queryReportRows(req) {
  const { type = 'passes', status, search, locationCode, from, to } = req.query;
  const baseScope = buildScopeFilters(req);
  if (locationCode && locationCode !== 'all') {
    baseScope.locationCode = locationCode.toUpperCase();
  }
  if (status && status !== 'all') {
    if (type === 'checklogs') baseScope.action = status;
    else baseScope.status = status;
  }

  const q = search?.toLowerCase().trim() || '';

  if (type === 'checklogs') {
    if (from || to) {
      baseScope.timestamp = {};
      if (from) baseScope.timestamp.$gte = new Date(from);
      if (to) baseScope.timestamp.$lte = new Date(to);
    }
    let rows = await CheckLog.find(baseScope)
      .populate('visitor', 'fullName email phone company')
      .populate('pass', 'passCode locationName')
      .populate('host', 'name department')
      .populate('scannedBy', 'name')
      .populate('organization', 'name code')
      .sort({ timestamp: -1 })
      .limit(500);

    if (q) {
      rows = rows.filter(
        (r) =>
          r.visitor?.fullName?.toLowerCase().includes(q) ||
          r.visitor?.company?.toLowerCase().includes(q) ||
          r.pass?.passCode?.toLowerCase().includes(q) ||
          r.gate?.toLowerCase().includes(q)
      );
    }
    return { type, rows };
  }

  if (type === 'appointments') {
    if (from || to) {
      baseScope.scheduledDate = {};
      if (from) baseScope.scheduledDate.$gte = new Date(from);
      if (to) baseScope.scheduledDate.$lte = new Date(to);
    }
    let rows = await Appointment.find(baseScope)
      .populate('visitor', 'fullName email phone company')
      .populate('host', 'name department')
      .populate('organization', 'name code')
      .sort({ scheduledDate: -1 })
      .limit(500);

    if (q) {
      rows = rows.filter(
        (r) =>
          r.appointmentCode?.toLowerCase().includes(q) ||
          r.visitor?.fullName?.toLowerCase().includes(q) ||
          r.visitor?.company?.toLowerCase().includes(q) ||
          r.host?.name?.toLowerCase().includes(q)
      );
    }
    return { type, rows };
  }

  if (from || to) {
    baseScope.validFrom = {};
    if (from) baseScope.validFrom.$gte = new Date(from);
    if (to) baseScope.validFrom.$lte = new Date(to);
  }
  let rows = await Pass.find(baseScope)
    .populate('visitor', 'fullName email phone company')
    .populate('host', 'name department')
    .populate('organization', 'name code')
    .sort({ createdAt: -1 })
    .limit(500);

  if (q) {
    rows = rows.filter(
      (r) =>
        r.passCode?.toLowerCase().includes(q) ||
        r.visitor?.fullName?.toLowerCase().includes(q) ||
        r.visitor?.company?.toLowerCase().includes(q) ||
        r.host?.name?.toLowerCase().includes(q)
    );
  }
  return { type: 'passes', rows };
}

export const getReports = asyncHandler(async (req, res) => {
  const { type, rows } = await queryReportRows(req);
  res.json({ success: true, type, count: rows.length, data: rows });
});

export const exportReports = asyncHandler(async (req, res) => {
  const { format = 'csv' } = req.query;
  const { type, rows } = await queryReportRows(req);

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.json"`);
    return res.json({ success: true, type, count: rows.length, data: rows });
  }

  let headers = [];
  let lines = [];

  if (type === 'checklogs') {
    headers = ['Timestamp', 'Pass Code', 'Visitor Name', 'Company', 'Action', 'Gate', 'Location', 'Scanned By', 'Organization'];
    lines = rows.map((r) =>
      [
        new Date(r.timestamp).toISOString(),
        r.pass?.passCode,
        r.visitor?.fullName,
        r.visitor?.company,
        r.action,
        r.gate,
        r.locationCode,
        r.scannedBy?.name,
        r.organization?.name,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  } else if (type === 'appointments') {
    headers = ['Appointment Code', 'Visitor Name', 'Email', 'Company', 'Host', 'Purpose', 'Scheduled Date', 'Type', 'Status', 'Location'];
    lines = rows.map((r) =>
      [
        r.appointmentCode,
        r.visitor?.fullName,
        r.visitor?.email,
        r.visitor?.company,
        r.host?.name,
        r.purpose,
        new Date(r.scheduledDate).toISOString(),
        r.type,
        r.status,
        r.locationName,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  } else {
    headers = ['Pass Code', 'Visitor Name', 'Company', 'Email', 'Host', 'Purpose', 'Location', 'Valid From', 'Valid Until', 'Status', 'Check-Ins'];
    lines = rows.map((r) =>
      [
        r.passCode,
        r.visitor?.fullName,
        r.visitor?.company,
        r.visitor?.email,
        r.host?.name,
        r.purpose,
        r.locationName,
        new Date(r.validFrom).toISOString(),
        new Date(r.validUntil).toISOString(),
        r.status,
        r.checkInCount,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  const csvContent = [headers.join(','), ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gatepass-${type}-report.csv"`);
  res.send(csvContent);
});
