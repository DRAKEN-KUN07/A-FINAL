import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Appointment } from '../models/Appointment.js';
import { AuditLog } from '../models/AuditLog.js';
import { CheckLog } from '../models/CheckLog.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { Organization } from '../models/Organization.js';
import { OtpToken } from '../models/OtpToken.js';
import { Pass } from '../models/Pass.js';
import { User } from '../models/User.js';
import { Visitor } from '../models/Visitor.js';
import {
  createSignedQrToken,
  generateAppointmentCode,
  generatePassCode,
  generateQrDataUrl,
} from '../services/qrService.js';

/**
 * Populate realistic multi-organization demo data across all collections:
 * Organizations, Users, Visitors, Appointments, Passes, CheckLogs, NotificationLogs, AuditLogs.
 */
export async function seedDemoData({ reset = false, quiet = false } = {}) {
  const existingOrgs = await Organization.countDocuments();
  if (!reset && existingOrgs > 0) {
    if (!quiet) console.log('[Seed] Database already contains data. Skipping seed (pass --reset to overwrite).');
    return { skipped: true };
  }

  if (reset) {
    await Promise.all([
      CheckLog.deleteMany({}),
      Pass.deleteMany({}),
      Appointment.deleteMany({}),
      Visitor.deleteMany({}),
      User.deleteMany({}),
      Organization.deleteMany({}),
      NotificationLog.deleteMany({}),
      AuditLog.deleteMany({}),
      OtpToken.deleteMany({}),
    ]);
  }

  // 1. Multi-Organization + Multi-Location setup
  const [techNova, apexBio] = await Organization.create([
    {
      name: 'TechNova Global HQ',
      code: 'TECHNOVA',
      industry: 'Cloud & AI Software',
      address: '450 Innovation Parkway, Bengaluru',
      contactEmail: 'reception@technova.io',
      contactPhone: '+91-80-4012-9000',
      requireOtpForCheckIn: false,
      locations: [
        { name: 'Main Campus', code: 'MAIN-GATE', building: 'Tower A', gateName: 'North Atrium Desk', active: true },
        { name: 'R&D Wing', code: 'RND-EAST', building: 'Tower B', gateName: 'East Security Turnstile', active: true },
      ],
    },
    {
      name: 'Apex BioLabs Campus',
      code: 'APEXBIO',
      industry: 'Biotechnology',
      address: '88 Genome Boulevard, Hyderabad',
      contactEmail: 'security@apexbiolabs.com',
      contactPhone: '+91-40-2910-5500',
      requireOtpForCheckIn: true,
      locations: [
        { name: 'Bio Research Center', code: 'LAB-WEST', building: 'Block 1', gateName: 'West Gate Desk', active: true },
      ],
    },
  ]);

  // 2. Users across all 4 roles
  const users = await User.create([
    {
      name: 'Sora Takahashi',
      email: 'admin@gatepass.io',
      password: 'Password123!',
      phone: '+919800110001',
      role: 'admin',
      department: 'Workplace Security & IT',
      designation: 'System Administrator',
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
    },
    {
      name: 'Vikram Nair',
      email: 'security@gatepass.io',
      password: 'Password123!',
      phone: '+919800110002',
      role: 'security',
      department: 'Physical Security',
      designation: 'Lead Frontdesk Officer',
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
    },
    {
      name: 'Aarav Mehta',
      email: 'employee@gatepass.io',
      password: 'Password123!',
      phone: '+919800110003',
      role: 'employee',
      department: 'Platform Engineering',
      designation: 'Staff Software Architect',
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
    },
    {
      name: 'Priya Sharma',
      email: 'priya@gatepass.io',
      password: 'Password123!',
      phone: '+919800110004',
      role: 'employee',
      department: 'People Operations',
      designation: 'Talent Partner',
      organization: techNova._id,
      locationCode: 'RND-EAST',
    },
    {
      name: 'Alex Rivera',
      email: 'visitor@gatepass.io',
      password: 'Password123!',
      phone: '+919800110005',
      role: 'visitor',
      department: 'External Guest',
      designation: 'Solutions Consultant',
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
    },
    {
      name: 'Meera Iyer',
      email: 'host.apex@gatepass.io',
      password: 'Password123!',
      phone: '+919800110006',
      role: 'employee',
      department: 'Genomics Lab',
      designation: 'Principal Scientist',
      organization: apexBio._id,
      locationCode: 'LAB-WEST',
    },
  ]);

  const [adminUser, securityUser, hostAarav, hostPriya, visitorUser, hostApex] = users;

  // 3. Visitors
  const visitors = await Visitor.create([
    {
      fullName: 'Alex Rivera',
      email: 'visitor@gatepass.io',
      phone: '+919800110005',
      company: 'CloudScale Solutions',
      idType: 'Passport',
      idNumber: 'P9823410',
      purpose: 'Quarterly Cloud Architecture Review',
      otpVerified: true,
      user: visitorUser._id,
      organization: techNova._id,
      createdBy: hostAarav._id,
    },
    {
      fullName: 'Neha Kapoor',
      email: 'neha.kapoor@designcraft.in',
      phone: '+919811223344',
      company: 'DesignCraft Studio',
      idType: 'National ID',
      idNumber: 'IND-4421-9012',
      purpose: 'UX Workshop & Brand Audit',
      otpVerified: true,
      organization: techNova._id,
      createdBy: hostPriya._id,
    },
    {
      fullName: 'Rohan Deshmukh',
      email: 'rohan@kinetichardware.com',
      phone: '+919822334455',
      company: 'Kinetic Hardware Inc',
      idType: 'Driver License',
      idNumber: 'DL-KA01-7789',
      purpose: 'Server Rack Maintenance',
      vehicleNumber: 'KA-01-MJ-4820',
      otpVerified: false,
      organization: techNova._id,
      createdBy: securityUser._id,
    },
    {
      fullName: 'Elena Vance',
      email: 'elena.vance@meridianvc.com',
      phone: '+919833445566',
      company: 'Meridian Ventures',
      idType: 'Passport',
      idNumber: 'US-5519082',
      purpose: 'Executive Strategy Briefing',
      otpVerified: true,
      organization: techNova._id,
      createdBy: adminUser._id,
    },
    {
      fullName: 'Dr. Siddharth Rao',
      email: 'siddharth.rao@medtech.org',
      phone: '+919844556677',
      company: 'MedTech Diagnostics',
      idType: 'National ID',
      idNumber: 'IND-8812-3044',
      purpose: 'Biosafety Audit Inspection',
      otpVerified: true,
      organization: apexBio._id,
      createdBy: hostApex._id,
    },
  ]);

  const [vAlex, vNeha, vRohan, vElena, vSiddharth] = visitors;

  const now = new Date();
  const hoursFromNow = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const daysAgo = (d, hour = 10) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    dt.setHours(hour, 15, 0, 0);
    return dt;
  };

  // 4. Appointments
  const appointments = await Appointment.create([
    {
      appointmentCode: generateAppointmentCode(),
      visitor: vAlex._id,
      host: hostAarav._id,
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
      locationName: 'Main Campus - North Atrium Desk',
      purpose: 'Quarterly Cloud Architecture Review',
      scheduledDate: hoursFromNow(1),
      expectedDurationMinutes: 120,
      type: 'invite',
      status: 'approved',
      approvedBy: hostAarav._id,
      approvedAt: daysAgo(1),
      otpVerified: true,
      createdBy: hostAarav._id,
    },
    {
      appointmentCode: generateAppointmentCode(),
      visitor: vNeha._id,
      host: hostPriya._id,
      organization: techNova._id,
      locationCode: 'RND-EAST',
      locationName: 'R&D Wing - East Security Turnstile',
      purpose: 'UX Workshop & Design Sprint',
      scheduledDate: hoursFromNow(-2),
      expectedDurationMinutes: 180,
      type: 'pre_registration',
      status: 'approved',
      approvedBy: hostPriya._id,
      approvedAt: daysAgo(1),
      otpVerified: true,
      createdBy: vNeha._id,
    },
    {
      appointmentCode: generateAppointmentCode(),
      visitor: vRohan._id,
      host: hostAarav._id,
      organization: techNova._id,
      locationCode: 'RND-EAST',
      locationName: 'R&D Wing - East Security Turnstile',
      purpose: 'Datacenter Rack Cabling Inspection',
      scheduledDate: hoursFromNow(4),
      expectedDurationMinutes: 90,
      type: 'pre_registration',
      status: 'pending',
      otpVerified: false,
      createdBy: securityUser._id,
    },
    {
      appointmentCode: generateAppointmentCode(),
      visitor: vElena._id,
      host: adminUser._id,
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
      locationName: 'Main Campus - North Atrium Desk',
      purpose: 'Q4 Executive Board Briefing',
      scheduledDate: daysAgo(2, 11),
      expectedDurationMinutes: 120,
      type: 'invite',
      status: 'completed',
      approvedBy: adminUser._id,
      approvedAt: daysAgo(3),
      otpVerified: true,
      createdBy: adminUser._id,
    },
    {
      appointmentCode: generateAppointmentCode(),
      visitor: vSiddharth._id,
      host: hostApex._id,
      organization: apexBio._id,
      locationCode: 'LAB-WEST',
      locationName: 'Bio Research Center - West Gate Desk',
      purpose: 'Biosafety Lab Certification',
      scheduledDate: hoursFromNow(2),
      expectedDurationMinutes: 120,
      type: 'invite',
      status: 'approved',
      approvedBy: hostApex._id,
      approvedAt: daysAgo(1),
      otpVerified: true,
      createdBy: hostApex._id,
    },
  ]);

  const [aptAlex, aptNeha, _aptRohan, aptElena, aptSiddharth] = appointments;

  // 5. Passes with real signed QR tokens & DataURLs
  const makePass = async ({ visitor, appointment, host, org, locCode, locName, purpose, validFrom, validUntil, status, checkInCount, lastCheckInAt, lastCheckOutAt, issuedBy }) => {
    const passCode = generatePassCode();
    const qrToken = createSignedQrToken({
      passCode,
      visitorId: visitor._id,
      organizationId: org._id,
    });
    const qrDataUrl = await generateQrDataUrl(qrToken);
    return Pass.create({
      passCode,
      qrToken,
      qrDataUrl,
      visitor: visitor._id,
      appointment: appointment?._id,
      host: host._id,
      organization: org._id,
      locationCode: locCode,
      locationName: locName,
      purpose,
      validFrom,
      validUntil,
      status,
      issuedBy: issuedBy._id,
      checkInCount,
      lastCheckInAt,
      lastCheckOutAt,
    });
  };

  const passAlex = await makePass({
    visitor: vAlex,
    appointment: aptAlex,
    host: hostAarav,
    org: techNova,
    locCode: 'MAIN-GATE',
    locName: 'Main Campus - North Atrium Desk',
    purpose: aptAlex.purpose,
    validFrom: hoursFromNow(-1),
    validUntil: hoursFromNow(12),
    status: 'active',
    checkInCount: 0,
    issuedBy: hostAarav,
  });

  const passNeha = await makePass({
    visitor: vNeha,
    appointment: aptNeha,
    host: hostPriya,
    org: techNova,
    locCode: 'RND-EAST',
    locName: 'R&D Wing - East Security Turnstile',
    purpose: aptNeha.purpose,
    validFrom: hoursFromNow(-3),
    validUntil: hoursFromNow(8),
    status: 'checked_in',
    checkInCount: 1,
    lastCheckInAt: hoursFromNow(-1.5),
    issuedBy: securityUser,
  });

  const passElena = await makePass({
    visitor: vElena,
    appointment: aptElena,
    host: adminUser,
    org: techNova,
    locCode: 'MAIN-GATE',
    locName: 'Main Campus - North Atrium Desk',
    purpose: aptElena.purpose,
    validFrom: daysAgo(2, 9),
    validUntil: daysAgo(2, 18),
    status: 'checked_out',
    checkInCount: 1,
    lastCheckInAt: daysAgo(2, 10),
    lastCheckOutAt: daysAgo(2, 14),
    issuedBy: securityUser,
  });

  const passSiddharth = await makePass({
    visitor: vSiddharth,
    appointment: aptSiddharth,
    host: hostApex,
    org: apexBio,
    locCode: 'LAB-WEST',
    locName: 'Bio Research Center - West Gate Desk',
    purpose: aptSiddharth.purpose,
    validFrom: hoursFromNow(-1),
    validUntil: hoursFromNow(10),
    status: 'active',
    checkInCount: 0,
    issuedBy: hostApex,
  });

  // 6. CheckLogs across recent days for Analytics charts
  await CheckLog.create([
    {
      pass: passElena._id,
      visitor: vElena._id,
      host: adminUser._id,
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
      gate: 'North Atrium Desk',
      action: 'check_in',
      scanMethod: 'qr_camera',
      scannedBy: securityUser._id,
      timestamp: daysAgo(2, 10),
      notes: 'ID verified at North Atrium',
    },
    {
      pass: passElena._id,
      visitor: vElena._id,
      host: adminUser._id,
      organization: techNova._id,
      locationCode: 'MAIN-GATE',
      gate: 'North Atrium Desk',
      action: 'check_out',
      scanMethod: 'qr_camera',
      scannedBy: securityUser._id,
      timestamp: daysAgo(2, 14),
      notes: 'Badge returned',
    },
    {
      pass: passNeha._id,
      visitor: vNeha._id,
      host: hostPriya._id,
      organization: techNova._id,
      locationCode: 'RND-EAST',
      gate: 'East Security Turnstile',
      action: 'check_in',
      scanMethod: 'qr_image',
      scannedBy: securityUser._id,
      timestamp: hoursFromNow(-1.5),
      notes: 'Escorted to R&D UX lab',
    },
  ]);

  // 7. NotificationLogs
  await NotificationLog.create([
    {
      channel: 'email',
      recipient: vAlex.email,
      subject: 'Your Digital Visitor Pass: ' + passAlex.passCode,
      message: `Hello Alex Rivera, your pass ${passAlex.passCode} for TechNova Global HQ is ready.`,
      eventType: 'PASS_ISSUED',
      status: 'simulated',
      provider: 'simulated-smtp',
      organization: techNova._id,
      relatedPass: passAlex._id,
      relatedAppointment: aptAlex._id,
    },
    {
      channel: 'sms',
      recipient: vAlex.phone,
      message: `GatePass: Your visitor pass ${passAlex.passCode} is active at Main Campus.`,
      eventType: 'PASS_ISSUED',
      status: 'simulated',
      provider: 'simulated-sms',
      organization: techNova._id,
      relatedPass: passAlex._id,
    },
    {
      channel: 'email',
      recipient: hostPriya.email,
      subject: 'Visitor Arrived: Neha Kapoor',
      message: `Neha Kapoor (DesignCraft Studio) has checked in at R&D Wing.`,
      eventType: 'VISITOR_CHECKED_IN',
      status: 'simulated',
      provider: 'simulated-smtp',
      organization: techNova._id,
      relatedPass: passNeha._id,
    },
  ]);

  // 8. AuditLogs
  await AuditLog.create([
    {
      action: 'SEED_DATABASE_INITIALIZED',
      entityType: 'System',
      actor: adminUser._id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      organization: techNova._id,
      details: { organizations: 2, users: users.length, visitors: visitors.length },
    },
    {
      action: 'PASS_ISSUED',
      entityType: 'Pass',
      entityId: passAlex._id,
      actor: hostAarav._id,
      actorName: hostAarav.name,
      actorRole: hostAarav.role,
      organization: techNova._id,
      details: { passCode: passAlex.passCode, visitorName: vAlex.fullName },
    },
    {
      action: 'VISITOR_CHECKED_IN',
      entityType: 'CheckLog',
      actor: securityUser._id,
      actorName: securityUser.name,
      actorRole: securityUser.role,
      organization: techNova._id,
      details: { passCode: passNeha.passCode, visitorName: vNeha.fullName },
    },
  ]);

  if (!quiet) {
    console.log(`[Seed] Seeded 2 organizations, ${users.length} users, ${visitors.length} visitors, 4 digital passes.`);
  }

  return {
    skipped: false,
    organizations: [techNova, apexBio],
    users,
    visitors,
    passes: [passAlex, passNeha, passElena, passSiddharth],
  };
}

// Allow direct CLI execution: `npm run seed`
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();

if (isDirectRun) {
  (async () => {
    try {
      await connectDatabase();
      const reset = !process.argv.includes('--no-reset');
      await seedDemoData({ reset, quiet: false });
      await disconnectDatabase();
      process.exit(0);
    } catch (err) {
      console.error('[Seed] Failed:', err);
      await disconnectDatabase();
      process.exit(1);
    }
  })();
}
