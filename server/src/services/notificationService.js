import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { NotificationLog } from '../models/NotificationLog.js';

let smtpTransporter = null;

function getTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return smtpTransporter;
}

/**
 * Send an Email or SMS notification via configured SMTP / Twilio providers,
 * gracefully falling back to simulated delivery logged in NotificationLogs.
 */
export async function sendNotification({
  channel,
  recipient,
  subject = '',
  message,
  eventType,
  organization,
  relatedPass,
  relatedAppointment,
}) {
  if (!recipient) return null;

  let status = 'simulated';
  let provider = channel === 'email' ? 'simulated-smtp' : 'simulated-sms';
  let errorMessage = '';

  if (channel === 'email') {
    const transporter = getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: env.smtpFrom,
          to: recipient,
          subject: subject || 'GatePass VMS Notification',
          text: message,
        });
        status = 'sent';
        provider = 'nodemailer-smtp';
      } catch (err) {
        status = 'failed';
        provider = 'nodemailer-smtp';
        errorMessage = err.message;
      }
    }
  } else if (channel === 'sms') {
    if (env.twilioAccountSid && env.twilioAuthToken && env.twilioFromNumber) {
      try {
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
        const body = new URLSearchParams({
          To: recipient,
          From: env.twilioFromNumber,
          Body: message,
        });
        const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        if (!response.ok) {
          throw new Error(`Twilio HTTP ${response.status}`);
        }
        status = 'sent';
        provider = 'twilio-sms';
      } catch (err) {
        status = 'failed';
        provider = 'twilio-sms';
        errorMessage = err.message;
      }
    }
  }

  return NotificationLog.create({
    channel,
    recipient,
    subject,
    message,
    eventType,
    status,
    provider,
    errorMessage,
    organization: organization?._id || organization || undefined,
    relatedPass: relatedPass?._id || relatedPass || undefined,
    relatedAppointment: relatedAppointment?._id || relatedAppointment || undefined,
  });
}

export async function dispatchEventNotifications({
  eventType,
  visitor,
  host,
  appointment,
  pass,
  organization,
}) {
  const logs = [];
  const orgName = organization?.name || 'GatePass Campus';

  if (eventType === 'APPOINTMENT_INVITE' && visitor) {
    const when = appointment?.scheduledDate
      ? new Date(appointment.scheduledDate).toLocaleString()
      : 'upcoming schedule';
    const text = `Hello ${visitor.fullName}, ${host?.name || 'your host'} invited you to ${orgName} on ${when} (${appointment?.purpose || 'Visit'}). Code: ${appointment?.appointmentCode}.`;
    if (visitor.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: visitor.email,
          subject: `Visitor Invitation from ${orgName}`,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
        })
      );
    }
    if (visitor.phone) {
      logs.push(
        await sendNotification({
          channel: 'sms',
          recipient: visitor.phone,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
        })
      );
    }
  } else if (eventType === 'APPOINTMENT_PENDING' && host) {
    const text = `New visitor pre-registration from ${visitor?.fullName || 'Visitor'} (${visitor?.company || 'Guest'}) for "${appointment?.purpose}". Review and approve in GatePass.`;
    if (host.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: host.email,
          subject: `Approval Needed: Visitor ${visitor?.fullName}`,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
        })
      );
    }
  } else if (eventType === 'APPOINTMENT_APPROVED' && visitor) {
    const text = `Good news ${visitor.fullName}! Your visit to ${orgName} (${appointment?.appointmentCode}) has been approved.${pass ? ` Digital Pass Code: ${pass.passCode}.` : ''}`;
    if (visitor.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: visitor.email,
          subject: `Visit Approved — ${orgName}`,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
          relatedPass: pass,
        })
      );
    }
    if (visitor.phone) {
      logs.push(
        await sendNotification({
          channel: 'sms',
          recipient: visitor.phone,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
          relatedPass: pass,
        })
      );
    }
  } else if (eventType === 'APPOINTMENT_REJECTED' && visitor) {
    const text = `Your visit request (${appointment?.appointmentCode}) to ${orgName} was declined. Reason: ${appointment?.rejectionReason || 'Host unavailable'}.`;
    if (visitor.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: visitor.email,
          subject: `Visit Request Update — ${orgName}`,
          message: text,
          eventType,
          organization,
          relatedAppointment: appointment,
        })
      );
    }
  } else if (eventType === 'PASS_ISSUED' && visitor && pass) {
    const text = `Your Digital Visitor Pass (${pass.passCode}) for ${orgName} (${pass.locationName}) is active until ${new Date(pass.validUntil).toLocaleString()}. Show the QR code at security.`;
    if (visitor.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: visitor.email,
          subject: `Your Digital Visitor Pass: ${pass.passCode}`,
          message: text,
          eventType,
          organization,
          relatedPass: pass,
        })
      );
    }
    if (visitor.phone) {
      logs.push(
        await sendNotification({
          channel: 'sms',
          recipient: visitor.phone,
          message: text,
          eventType,
          organization,
          relatedPass: pass,
        })
      );
    }
  } else if (eventType === 'VISITOR_CHECKED_IN' && host && visitor) {
    const text = `${visitor.fullName} (${visitor.company || 'Guest'}) has checked in at ${pass?.locationName || 'Reception'} using Pass ${pass?.passCode}.`;
    if (host.email) {
      logs.push(
        await sendNotification({
          channel: 'email',
          recipient: host.email,
          subject: `Visitor Arrived: ${visitor.fullName}`,
          message: text,
          eventType,
          organization,
          relatedPass: pass,
        })
      );
    }
    if (host.phone) {
      logs.push(
        await sendNotification({
          channel: 'sms',
          recipient: host.phone,
          message: text,
          eventType,
          organization,
          relatedPass: pass,
        })
      );
    }
  }

  return logs.filter(Boolean);
}
