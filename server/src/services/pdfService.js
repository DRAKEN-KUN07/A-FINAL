import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { generateQrBuffer } from './qrService.js';

function resolveLocalPhotoPath(photoUrl) {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) return null;
  const rel = photoUrl.replace(/^\/uploads\//, '');
  const fullPath = path.resolve(UPLOAD_ROOT, rel);
  if (!fullPath.startsWith(UPLOAD_ROOT)) return null;
  if (!fs.existsSync(fullPath)) return null;
  const ext = path.extname(fullPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;
  return fullPath;
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Render a printable PDF visitor pass badge containing visitor details, photo/initials,
 * host & organization metadata, validity window, and an embedded high-contrast QR code.
 */
export async function generatePassPdfBuffer(passDoc) {
  const qrBuffer = await generateQrBuffer(passDoc.qrToken);
  const photoPath = resolveLocalPhotoPath(passDoc.visitor?.photoUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [420, 620],
      margin: 24,
      info: {
        Title: `Visitor Pass - ${passDoc.passCode}`,
        Author: passDoc.organization?.name || 'GatePass VMS',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;

    // Top Header Band
    doc.rect(0, 0, pageWidth, 92).fill('#0f172a');
    doc.rect(0, 92, pageWidth, 6).fill('#0ea5e9');

    doc
      .fillColor('#38bdf8')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('OFFICIAL DIGITAL VISITOR PASS', 24, 22, { characterSpacing: 1.5 });

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(passDoc.organization?.name || 'Organization Reception', 24, 40, { width: 280 });

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(10)
      .text(`${passDoc.locationName || 'Main Reception'} (${passDoc.locationCode || 'MAIN'})`, 24, 66);

    // Status pill in header
    const statusLabel = String(passDoc.status || 'active').replace('_', ' ').toUpperCase();
    doc.roundedRect(300, 28, 96, 24, 12).fill('#0ea5e9');
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(statusLabel, 300, 36, { width: 96, align: 'center' });

    // Visitor Photo / Avatar Box
    const photoX = 24;
    const photoY = 120;
    const photoSize = 84;
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).fill('#e2e8f0');

    if (photoPath) {
      try {
        doc.save();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).clip();
        doc.image(photoPath, photoX, photoY, { fit: [photoSize, photoSize], align: 'center', valign: 'center' });
        doc.restore();
      } catch {
        drawInitialsAvatar(doc, passDoc.visitor?.fullName, photoX, photoY, photoSize);
      }
    } else {
      drawInitialsAvatar(doc, passDoc.visitor?.fullName, photoX, photoY, photoSize);
    }

    // Visitor Identity Details
    const infoX = 122;
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(passDoc.visitor?.fullName || 'Visitor', infoX, 122, { width: 274 });

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(11)
      .text(passDoc.visitor?.company || 'Independent Visitor', infoX, 145, { width: 274 });

    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(9.5)
      .text(`Phone: ${passDoc.visitor?.phone || 'N/A'}`, infoX, 165, { width: 274 })
      .text(
        `ID: ${passDoc.visitor?.idType || 'ID'} ${passDoc.visitor?.idNumber || 'Verified'}`,
        infoX,
        180,
        { width: 274 }
      );

    // Metadata Card
    const cardY = 224;
    doc.roundedRect(24, cardY, pageWidth - 48, 128, 8).fillAndStroke('#f8fafc', '#cbd5e1');

    const drawField = (label, value, x, y, width = 175) => {
      doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y);
      doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(value || 'N/A', x, y + 12, { width });
    };

    drawField('Pass Code', passDoc.passCode, 38, cardY + 14);
    drawField('Host / Employee', passDoc.host?.name || 'Reception Host', 220, cardY + 14);
    drawField('Purpose of Visit', passDoc.purpose || 'Scheduled Visit', 38, cardY + 52, 344);
    drawField('Valid From', formatDateTime(passDoc.validFrom), 38, cardY + 90);
    drawField('Valid Until', formatDateTime(passDoc.validUntil), 220, cardY + 90);

    // QR Verification Section
    const qrBoxY = 372;
    doc.roundedRect(24, qrBoxY, pageWidth - 48, 198, 10).fillAndStroke('#ffffff', '#e2e8f0');

    doc.image(qrBuffer, (pageWidth - 140) / 2, qrBoxY + 14, { width: 140, height: 140 });

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('SCAN QR AT SECURITY DESK FOR CHECK-IN / CHECK-OUT', 34, qrBoxY + 162, {
        width: pageWidth - 68,
        align: 'center',
      });

    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Issued by ${passDoc.issuedBy?.name || 'Security Desk'} • Keep badge visible at all times`, 24, 584, {
        width: pageWidth - 48,
        align: 'center',
      });

    doc.end();
  });
}

function drawInitialsAvatar(doc, name = 'V', x, y, size) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'V';

  doc.roundedRect(x, y, size, size, 10).fill('#0284c7');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(26)
    .text(initials, x, y + 28, { width: size, align: 'center' });
}
