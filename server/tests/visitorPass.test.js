import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { UPLOAD_ROOT } from '../src/middleware/upload.js';
import { seedDemoData } from '../src/seed/seedData.js';
import { verifySignedQrToken } from '../src/services/qrService.js';

let mongod;
let adminToken;
let securityToken;
let employeeToken;
let visitorToken;
let seededData;
const uploadedTestFiles = [];

// Minimal valid 1x1 transparent PNG buffer for photo upload tests
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  seededData = await seedDemoData({ reset: true, quiet: true });

  const loginAs = async (email) => {
    const res = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  adminToken = await loginAs('admin@gatepass.io');
  securityToken = await loginAs('security@gatepass.io');
  employeeToken = await loginAs('employee@gatepass.io');
  visitorToken = await loginAs('visitor@gatepass.io');
});

afterAll(async () => {
  await disconnectDatabase();
  if (mongod) await mongod.stop();
  for (const relPath of uploadedTestFiles) {
    const full = path.resolve(UPLOAD_ROOT, relPath.replace(/^\/uploads\//, ''));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
});

describe('GatePass Visitor Pass Management API', () => {
  it('serves health check and public directory', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const dir = await request(app).get('/api/auth/directory');
    expect(dir.status).toBe(200);
    expect(dir.body.data.organizations.length).toBeGreaterThanOrEqual(2);
    expect(dir.body.data.hosts.length).toBeGreaterThanOrEqual(2);
  });

  it('enforces JWT authentication and role-based access control', async () => {
    const unauth = await request(app).get('/api/visitors');
    expect(unauth.status).toBe(401);

    const visitorAdminAttempt = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${visitorToken}`);
    expect(visitorAdminAttempt.status).toBe(403);

    const visitorScanAttempt = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ passCode: 'VP-TEST' });
    expect(visitorScanAttempt.status).toBe(403);
  });

  it('supports visitor self-registration and 6-digit OTP verification', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Taylor Brooks',
      email: 'taylor.brooks@example.com',
      password: 'Password123!',
      phone: '+919899001122',
      company: 'Horizon Labs',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('visitor');
    expect(reg.body.visitor.otpVerified).toBe(false);

    const otpReq = await request(app).post('/api/auth/otp/request').send({
      identifier: 'taylor.brooks@example.com',
      channel: 'email',
      purpose: 'visitor_verify',
      visitorId: reg.body.visitor._id,
    });
    expect(otpReq.status).toBe(200);
    const demoOtp = otpReq.body.data.demoOtp;
    expect(demoOtp).toMatch(/^\d{6}$/);

    const badVerify = await request(app).post('/api/auth/otp/verify').send({
      identifier: 'taylor.brooks@example.com',
      code: '000000',
      purpose: 'visitor_verify',
    });
    expect(badVerify.status).toBe(400);

    const goodVerify = await request(app).post('/api/auth/otp/verify').send({
      identifier: 'taylor.brooks@example.com',
      code: demoOtp,
      purpose: 'visitor_verify',
    });
    expect(goodVerify.status).toBe(200);
    expect(goodVerify.body.data.verified).toBe(true);
  });

  it('registers a visitor with multipart photo upload, serves it, and embeds it in a PDF badge', async () => {
    const createRes = await request(app)
      .post('/api/visitors')
      .set('Authorization', `Bearer ${securityToken}`)
      .field('fullName', 'Maya Lin')
      .field('email', 'maya.lin@partner.io')
      .field('phone', '+919877665544')
      .field('company', 'Partner Dynamics')
      .field('idType', 'Passport')
      .field('idNumber', 'P-77812')
      .attach('photo', TINY_PNG, { filename: 'maya.png', contentType: 'image/png' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.photoUrl).toMatch(/^\/uploads\/visitors\/visitor-.*\.png$/);
    uploadedTestFiles.push(createRes.body.data.photoUrl);

    const assetRes = await request(app).get(createRes.body.data.photoUrl);
    expect(assetRes.status).toBe(200);

    // Issue pass for visitor with uploaded photo and verify PDF + public verification endpoint
    const passRes = await request(app)
      .post('/api/passes')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        visitorId: createRes.body.data._id,
        purpose: 'Security Hardware Walkthrough',
        validHours: 6,
      });
    expect(passRes.status).toBe(201);

    const pdfRes = await request(app)
      .get(`/api/passes/${passRes.body.data._id}/pdf`)
      .set('Authorization', `Bearer ${securityToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.slice(0, 4).toString('utf8')).toBe('%PDF');

    const publicRes = await request(app).get(`/api/passes/public/${passRes.body.data.passCode}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.visitor.fullName).toBe('Maya Lin');
  });

  it('completes full lifecycle: pre-registration -> host approval -> QR pass -> PDF badge -> check-in -> check-out', async () => {
    const host = seededData.users.find((u) => u.email === 'employee@gatepass.io');

    // 1. Visitor pre-registers an appointment
    const aptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({
        hostId: host._id.toString(),
        organizationId: seededData.organizations[0]._id.toString(),
        locationCode: 'MAIN-GATE',
        purpose: 'API Integration Workshop',
        scheduledDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        expectedDurationMinutes: 90,
      });

    expect(aptRes.status).toBe(201);
    expect(aptRes.body.data.status).toBe('pending');
    const appointmentId = aptRes.body.data._id;

    // 2. Host employee approves and auto-issues QR pass
    const approveRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ issuePass: true });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');
    expect(approveRes.body.pass.passCode).toMatch(/^VP-\d{4}-[A-F0-9]{6}$/);

    const pass = approveRes.body.pass;
    expect(verifySignedQrToken(pass.qrToken).valid).toBe(true);
    expect(verifySignedQrToken(`${pass.qrToken}tamper`).valid).toBe(false);

    // 3. Download PDF badge & check valid PDF header
    const pdfRes = await request(app)
      .get(`/api/passes/${pass._id}/pdf`)
      .set('Authorization', `Bearer ${visitorToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.slice(0, 4).toString('utf8')).toBe('%PDF');

    // 4. Security scans QR token to check in
    const checkInRes = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        qrToken: pass.qrToken,
        action: 'check_in',
        gate: 'North Atrium Desk',
        scanMethod: 'qr_camera',
      });
    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.data.action).toBe('check_in');
    expect(checkInRes.body.data.pass.status).toBe('checked_in');

    // Duplicate check-in must be rejected
    const dupCheckIn = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: pass.qrToken, action: 'check_in' });
    expect(dupCheckIn.status).toBe(400);

    // 5. Security scans passCode to check out
    const checkOutRes = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        passCode: pass.passCode,
        action: 'check_out',
        gate: 'North Atrium Desk',
        scanMethod: 'manual_code',
      });
    expect(checkOutRes.status).toBe(201);
    expect(checkOutRes.body.data.action).toBe('check_out');
    expect(checkOutRes.body.data.pass.status).toBe('checked_out');
  });

  it('rejects cross-organization scans and revoked passes', async () => {
    const apexPass = seededData.passes.find(
      (p) => String(p.organization) === String(seededData.organizations[1]._id)
    );
    expect(apexPass).toBeTruthy();

    // TechNova security officer cannot scan an Apex BioLabs pass
    const crossOrgScan = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ passCode: apexPass.passCode, action: 'check_in' });
    expect(crossOrgScan.status).toBe(403);

    // Admin revokes a pass and verifies scan fails
    const revokeRes = await request(app)
      .patch(`/api/passes/${apexPass._id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Visit rescheduled' });
    expect(revokeRes.status).toBe(200);

    const scanRevoked = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ passCode: apexPass.passCode, action: 'check_in' });
    expect(scanRevoked.status).toBe(400);
  });

  it('supports multi-organization & location creation, dashboard analytics, notification logs, audit logs, and CSV export', async () => {
    const orgRes = await request(app)
      .post('/api/admin/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vertex Robotics',
        code: 'VERTEX',
        industry: 'Robotics',
        address: '12 Automation Ave',
      });
    expect(orgRes.status).toBe(201);

    const locRes = await request(app)
      .post(`/api/admin/organizations/${orgRes.body.data._id}/locations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'South Annex',
        code: 'SOUTH-GATE',
        building: 'Hangar 2',
        gateName: 'South Gate Desk',
      });
    expect(locRes.status).toBe(201);
    expect(locRes.body.data.locations.some((l) => l.code === 'SOUTH-GATE')).toBe(true);

    const stats = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data.dailyTraffic).toHaveLength(7);

    const reports = await request(app)
      .get('/api/dashboard/reports?type=passes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reports.status).toBe(200);
    expect(reports.body.data.length).toBeGreaterThan(0);

    const csv = await request(app)
      .get('/api/dashboard/export?type=checklogs&format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Timestamp,Pass Code,Visitor Name');

    const notifications = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(notifications.status).toBe(200);
    expect(notifications.body.data.length).toBeGreaterThan(0);

    const audits = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(audits.status).toBe(200);
    expect(audits.body.data.length).toBeGreaterThan(0);
  });
});
