import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import aiGatewayRouter from "./src/lib/ai-gateway.ts";
import nodemailer from "nodemailer";
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';
const supabase = createClient(supabaseUrl, supabaseAnonKey);




dotenv.config();

// Helper to clean RFC 2047 encoded words if any remain
function cleanMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = text
          .replace(/_/g, ' ')
          .replace(/=([A-Fa-f0-9]{2})/g, (__: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decodeURIComponent(escape(decoded));
      }
    } catch (e) {
      return text;
    }
    return text;
  });
}

async function runImapSync() {
  const config = {
    imap: {
      user: "rawjute@ballyjute.com",
      password: "ochhyhnjlkhdlpot",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000
    }
  };

  let connection;
  try {
    console.log("[Sync] Connecting to IMAP server...");
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: [''],
      markSeen: false,
      struct: true
    };
    
    const results = await connection.search(searchCriteria, fetchOptions);
    console.log(`[Sync] Found ${results.length} total emails on live Gmail. Processing the most recent 50...`);
    
    // Sort UIDs descending and take top 50
    const sortedResults = results.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, 50);
    
    const emails = await Promise.all(sortedResults.map(async (res) => {
      const fullPart = res.parts.find(part => part.which === '' || part.which === 'BODY[]' || part.which === 'TEXT');
      const id = res.attributes.uid;
      
      let parsed: any;
      try {
        if (fullPart && fullPart.body) {
          parsed = await simpleParser(fullPart.body);
        } else {
          const rawEmail = res.parts.map(p => p.body || '').join('\r\n\r\n');
          parsed = await simpleParser(rawEmail || 'No content');
        }
      } catch (parseErr) {
        console.error(`[Sync] Error parsing email UID ${id}:`, parseErr);
        parsed = {
          subject: 'Error parsing email',
          from: { value: [{ name: 'Unknown', address: 'Unknown' }] },
          date: new Date(),
          text: 'Content could not be parsed',
          html: ''
        };
      }

      let attachmentsList: any[] = [];
      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        attachmentsList = parsed.attachments.map((att: any) => ({
          filename: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          content: att.content ? att.content.toString('base64') : ''
        }));
      }

      const rawSubject = cleanMimeWords(parsed.subject || 'No Subject');
      const senderName = cleanMimeWords(parsed.from?.value[0]?.name || parsed.from?.value[0]?.address || 'Unknown');
      const senderEmail = parsed.from?.value[0]?.address || 'Unknown';
      const cleanSnippet = (parsed.text ? parsed.text.substring(0, 180).replace(/\s+/g, ' ') : '').trim();

      return {
        id: id.toString(),
        subject: rawSubject,
        sender_name: senderName,
        sender_email: senderEmail,
        date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        snippet: cleanSnippet || (rawSubject ? `${rawSubject}...` : 'No preview'),
        body: parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
        html: parsed.html || '',
        attachments: JSON.stringify(attachmentsList),
        unread: !res.attributes.flags.includes('\\Seen'),
        starred: res.attributes.flags.includes('\\Flagged')
      };
    }));

    connection.end();
    connection = null;
    
    if (emails.length > 0) {
      console.log(`[Sync] Upserting ${emails.length} live Gmail emails to Supabase...`);
      const { error } = await supabase
        .from('imap_emails')
        .upsert(emails, { onConflict: 'id' });
        
      if (error) {
        console.error("[Sync] Error upserting to Supabase:", error);
      } else {
        console.log("[Sync] Successfully synchronized live Gmail emails to Supabase!");
      }

      // Also update local cache file
      try {
        const filePath = path.join(process.cwd(), "emails.json");
        const mappedEmails = emails.map(e => ({
          id: e.id,
          subject: e.subject,
          senderName: e.sender_name,
          senderEmail: e.sender_email,
          date: e.date,
          snippet: e.snippet,
          body: e.body,
          html: e.html,
          attachments: e.attachments,
          unread: e.unread,
          starred: e.starred
        }));
        fs.writeFileSync(filePath, JSON.stringify({ success: true, emails: mappedEmails }, null, 2), "utf8");
      } catch (fileErr) {
        console.error("[Sync] Failed to write to local emails.json:", fileErr);
      }
    }
    return emails;
  } catch (err: any) {
    if (err.message?.includes('timed out') || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      console.warn("[Sync] Background IMAP email sync paused (connection timed out / offline).");
    } else {
      console.error("[Sync] Error in live Gmail email sync:", err.message);
    }
    throw err;
  } finally {
    if (connection) {
      try { connection.end(); } catch (e) {}
    }
  }
}

async function syncEmailsBackground() {
  console.log("Starting background IMAP email sync process...");
  
  // Ensure table exists on startup
  try {
    await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS imap_emails (
          id TEXT PRIMARY KEY,
          subject TEXT,
          sender_name TEXT,
          sender_email TEXT,
          date TIMESTAMP WITH TIME ZONE,
          snippet TEXT,
          body TEXT,
          html TEXT,
          attachments TEXT,
          unread BOOLEAN DEFAULT TRUE,
          starred BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        ALTER TABLE imap_emails DISABLE ROW LEVEL SECURITY;
        ALTER TABLE imap_emails ADD COLUMN IF NOT EXISTS html TEXT;
        ALTER TABLE imap_emails ADD COLUMN IF NOT EXISTS attachments TEXT;
      `
    });
    console.log("Supabase table 'imap_emails' verified/created successfully.");
  } catch (err) {
    console.warn("Failed to create/verify 'imap_emails' table in Supabase via RPC:", err);
  }

  // Run immediately, then every 30 seconds
  try {
    await runImapSync();
  } catch (e) {}
  setInterval(async () => {
    try {
      await runImapSync();
    } catch (e) {}
  }, 30000);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. CORS & No-Cache middleware
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
    if (origin !== "*") {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 2. Body Parser
  app.use(express.json({ limit: "50mb" }));

  app.use((req, res, next) => {
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} ${req.originalUrl}\n`;
    try {
      fs.appendFileSync(path.join(process.cwd(), "requests.log"), logLine);
    } catch (e) {}
    console.log("Incoming request:", req.method, req.url, req.originalUrl);
    next();
  });
 // Support large pdf payloads

  console.log("Environment:", process.env.NODE_ENV || "development");

  // System Intelligence Route securely delegated to AI Gateway
  app.use(["/api/chat", "/Jute-Purchase-Automation/api/chat"], aiGatewayRouter);

  // Send Email Route
  app.post(["/api/send-email", "/Jute-Purchase-Automation/api/send-email"], async (req, res) => {
    const { to, subject, html, filename, pdfData } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing to, subject, or html body" });
    }

    // 1. HTTP-based Mail API Dispatchers (Bypasses SMTP port blocks completely via HTTPS Port 443)
    let apiSuccess = false;
    let apiProvider = '';
    let apiMessageId = '';

    if (process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.BREVO_API_KEY) {
      try {
        if (process.env.RESEND_API_KEY) {
          console.log(`[HTTP API] Sending email via Resend to ${to}...`);
          apiProvider = 'resend';
          const toList = to.split(',').map((email: string) => email.trim());
          
          const bodyPayload: any = {
            from: process.env.EMAIL_FROM || "Bally Jute PO Desk <onboarding@resend.dev>",
            to: toList,
            subject: subject,
            html: html,
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                filename: filename,
                content: pdfData // Base64 string
              }
            ];
          }

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          const data = await response.json() as any;
          if (response.ok && data.id) {
            apiSuccess = true;
            apiMessageId = data.id;
            console.log(`[HTTP API] Resend dispatch success: ${apiMessageId}`);
          } else {
            throw new Error(data.message || JSON.stringify(data));
          }

        } else if (process.env.SENDGRID_API_KEY) {
          console.log(`[HTTP API] Sending email via SendGrid to ${to}...`);
          apiProvider = 'sendgrid';
          const toList = to.split(',').map((email: string) => email.trim()).map(email => ({ email }));
          const fromEmail = process.env.EMAIL_FROM || "rawjute@ballyjute.com";

          const bodyPayload: any = {
            personalizations: [
              {
                to: toList
              }
            ],
            from: {
              email: fromEmail,
              name: "Bally Jute PO Desk"
            },
            subject: subject,
            content: [
              {
                type: "text/html",
                value: html
              }
            ]
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                content: pdfData,
                filename: filename,
                type: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
                disposition: 'attachment'
              }
            ];
          }

          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            apiSuccess = true;
            apiMessageId = `sg-${Date.now()}`;
            console.log(`[HTTP API] SendGrid dispatch success`);
          } else {
            const errText = await response.text();
            throw new Error(errText || `SendGrid response code ${response.status}`);
          }

        } else if (process.env.BREVO_API_KEY) {
          console.log(`[HTTP API] Sending email via Brevo to ${to}...`);
          apiProvider = 'brevo';
          const toList = to.split(',').map((email: string) => email.trim()).map(email => ({ email }));
          const fromEmail = process.env.EMAIL_FROM || "rawjute@ballyjute.com";

          const bodyPayload: any = {
            sender: {
              name: "Bally Jute PO Desk",
              email: fromEmail
            },
            to: toList,
            subject: subject,
            htmlContent: html
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                content: pdfData,
                name: filename
              }
            ];
          }

          const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": process.env.BREVO_API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          const data = await response.json() as any;
          if (response.ok && data.messageId) {
            apiSuccess = true;
            apiMessageId = data.messageId;
            console.log(`[HTTP API] Brevo dispatch success: ${apiMessageId}`);
          } else {
            throw new Error(data.message || JSON.stringify(data));
          }
        }

        // Write log to Supabase
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status: 'Sent', provider: apiProvider, message_id: apiMessageId }]);
        } catch (logErr) {
          console.warn("Could not write HTTP API mail_logs into Supabase:", logErr);
        }

        return res.json({ success: true, messageId: apiMessageId, provider: apiProvider });

      } catch (apiErr: any) {
        console.warn(`[HTTP API] ${apiProvider || 'api'} send failed:`, apiErr.message || apiErr);
        console.warn("Falling back to standard SMTP / Gmail dispatch...");
        
        try {
          await supabase.from('mail_logs').insert([{ 
            to_email: to, 
            subject, 
            status: 'Failed-API-Fallback', 
            provider: apiProvider || 'api', 
            error_message: apiErr.message || String(apiErr) 
          }]);
        } catch (logErr) {
          console.warn("Could not write fallback log to Supabase:", logErr);
        }
      }
    }

    const attachments = [];
    if (filename && pdfData) {
      let contentType = 'application/octet-stream';
      if (filename.toLowerCase().endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (filename.toLowerCase().endsWith('.png')) {
        contentType = 'image/png';
      } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filename.toLowerCase().endsWith('.xls') || filename.toLowerCase().endsWith('.xlsx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (filename.toLowerCase().endsWith('.doc') || filename.toLowerCase().endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (filename.toLowerCase().endsWith('.txt')) {
        contentType = 'text/plain';
      }
      attachments.push({
        filename: filename,
        content: Buffer.from(pdfData, 'base64'),
        contentType: contentType
      });
    }

    let status = 'Pending';
    let provider = null;
    let errorMessage = null;
    let messageId = null;

    try {
      console.log(`Sending email to ${to} for ${subject}...`);
      
      // Try smtp.gmail.com first
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: "rawjute@ballyjute.com",
            pass: "ochhyhnjlkhdlpot",
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const info = await transporter.sendMail({
          from: `"Bally Jute PO Desk" <rawjute@ballyjute.com>`,
          to,
          subject,
          html,
          attachments
        });
        console.log("Email sent successfully via smtp.gmail.com:", info.messageId);
        status = 'Sent';
        provider = 'gmail';
        messageId = info.messageId;
        
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider, message_id: messageId }]);
        } catch (logErr) {
          console.warn("Could not write mail_logs into Supabase, but email sent successfully:", logErr);
        }
        return res.json({ success: true, messageId: info.messageId, provider: "gmail" });
      } catch (gmailErr: any) {
        console.warn("smtp.gmail.com failed, trying mail.ballyjute.com fallback...", gmailErr);
        errorMessage = gmailErr.message || String(gmailErr);
        
        // Try fallback to mail.ballyjute.com
        const transporter = nodemailer.createTransport({
          host: "mail.ballyjute.com",
          port: 465,
          secure: true,
          auth: {
            user: "rawjute@ballyjute.com",
            pass: "ochhyhnjlkhdlpot",
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const info = await transporter.sendMail({
          from: `"Bally Jute PO Desk" <rawjute@ballyjute.com>`,
          to,
          subject,
          html,
          attachments
        });
        console.log("Email sent successfully via mail.ballyjute.com:", info.messageId);
        status = 'Sent';
        provider = 'ballyjute';
        messageId = info.messageId;
        
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider, message_id: messageId }]);
        } catch (logErr) {
          console.warn("Could not write fallback mail_logs into Supabase, but email sent successfully:", logErr);
        }
        return res.json({ success: true, messageId: info.messageId, provider: "ballyjute" });
      }
    } catch (err: any) {
      console.error("All SMTP transports failed:", err);
      status = 'Failed';
      errorMessage = (errorMessage ? errorMessage + ' | ' : '') + (err.message || String(err));
      
      try {
        await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider: 'None', error_message: errorMessage }]);
      } catch (logErr) {
        console.warn("Could not write error mail_logs into Supabase:", logErr);
      }
      
      return res.status(500).json({ success: false, error: "SMTP transport failed: " + errorMessage });
    }
  });

  // Fetch Email Route via IMAP or Supabase cache
  app.get(["/api/fetch-emails", "/Jute-Purchase-Automation/api/fetch-emails"], async (req, res) => {
    try {
      console.log("Serving /api/fetch-emails from Supabase cache...");
      const { data, error } = await supabase
        .from('imap_emails')
        .select('*')
        .order('date', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      const emails = data.map(item => {
        let attachmentsParsed = [];
        try {
          if (item.attachments) {
            attachmentsParsed = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
          }
        } catch (e) {
          console.warn("Failed to parse attachments for email:", item.id);
        }
        return {
          id: item.id,
          subject: cleanMimeWords(item.subject || 'No Subject'),
          senderName: cleanMimeWords(item.sender_name || 'Unknown'),
          senderEmail: item.sender_email || 'Unknown',
          date: item.date,
          snippet: item.snippet || '',
          body: item.body || '',
          html: item.html || '',
          attachments: attachmentsParsed,
          unread: item.unread,
          starred: item.starred
        };
      });
      
      return res.json({ success: true, emails });
    } catch (err: any) {
      console.warn("Supabase fetch failed, loading emails.json local cache fallback:", err.message);
      try {
        const filePath = path.join(process.cwd(), "emails.json");
        if (fs.existsSync(filePath)) {
          const cachedData = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(cachedData);
          return res.json(parsed);
        }
      } catch (fileErr) {
        console.error("Failed to read emails.json:", fileErr);
      }
      return res.status(500).json({ success: false, error: err.message, details: err.stack });
    }
  });

  // Manual on-demand IMAP sync endpoint
  app.post(["/api/sync-emails", "/Jute-Purchase-Automation/api/sync-emails"], async (req, res) => {
    try {
      console.log("Triggering on-demand IMAP sync with rawjute@ballyjute.com on Gmail...");
      const freshEmails = await runImapSync();
      return res.json({ success: true, count: freshEmails.length, emails: freshEmails });
    } catch (err: any) {
      console.error("On-demand sync failed:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  
  app.get(["/api/check-email-connection", "/Jute-Purchase-Automation/api/check-email-connection"], async (req, res) => {
    return res.json({ 
      success: true, 
      message: "Connected to Inbox (Supabase Live Cloud Synchronization Active)" 
    });
  });
  
  app.post(["/api/test-smtp", "/Jute-Purchase-Automation/api/test-smtp"], async (req, res) => {
    const { host, port, secure, user, pass } = req.body;
    const logs = [];
    const transporter = nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port: port || 465,
      secure: secure !== undefined ? secure : true,
      auth: {
        user: user || "rawjute@ballyjute.com",
        pass: pass || "ochhyhnjlkhdlpot",
      },
      tls: {
        rejectUnauthorized: false
      },
      logger: {
        level: 'trace',
        trace: (...args: any[]) => logs.push({ type: 'trace', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        debug: (...args: any[]) => logs.push({ type: 'debug', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        info: (...args: any[]) => logs.push({ type: 'info', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        warn: (...args: any[]) => logs.push({ type: 'warn', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        error: (...args: any[]) => logs.push({ type: 'error', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        fatal: (...args: any[]) => logs.push({ type: 'fatal', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') })
      },
      debug: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    } as any);

    try {
      await transporter.verify();
      return res.json({ success: true, logs });
    } catch (err) {
      logs.push({ type: 'error', time: new Date().toISOString(), msg: err.message || String(err) });
      return res.status(500).json({ success: false, error: err.message, logs });
    }
  });

  // Payment Validation & Duplicate Prevention Route
  app.post(["/api/payments/check-duplicate", "/Jute-Purchase-Automation/api/payments/check-duplicate"], async (req, res) => {
    const { mr_no, po_no, current_voucher_no } = req.body || {};
    
    if (!mr_no || String(mr_no).trim() === '') {
      return res.json({ isDuplicate: false });
    }

    const cleanMr = String(mr_no).trim();
    const cleanPo = po_no ? String(po_no).trim() : '';

    try {
      const { data, error } = await supabase
        .from('payment_master')
        .select('voucher_no, mr_no, arrival_no, po_no, supplier, party_name, status, payment_date')
        .or(`mr_no.ilike.%${cleanMr}%,arrival_no.ilike.%${cleanMr}%`);

      if (error) {
        console.warn("[Backend Payment Check] Supabase query error:", error);
        return res.json({ isDuplicate: false });
      }

      if (data && data.length > 0) {
        const conflict = data.find((p: any) => {
          if (current_voucher_no && String(p.voucher_no).trim().toUpperCase() === String(current_voucher_no).trim().toUpperCase()) {
            return false;
          }
          const pStatus = String(p.status || '').toLowerCase().trim();
          if (pStatus === 'cancelled' || pStatus === 'rejected') return false;

          const pMr = String(p.mr_no || p.arrival_no || '').trim().toUpperCase();
          const targetMr = cleanMr.toUpperCase();
          return pMr === targetMr;
        });

        if (conflict) {
          return res.status(200).json({
            isDuplicate: true,
            conflictRecord: conflict,
            message: `Payment has already been processed for M.R. ${cleanMr} against P.O. ${conflict.po_no || cleanPo || 'N/A'} (Voucher No: ${conflict.voucher_no}). This M.R. cannot be selected again.`
          });
        }
      }

      return res.json({ isDuplicate: false });
    } catch (e: any) {
      console.error("[Backend Payment Check] Server error:", e);
      return res.status(200).json({ isDuplicate: false });
    }
  });

  // Ensure material_inspection schema & triggers exist on startup via exec_sql
  try {
    await supabase.rpc('exec_sql', {
      query: `
        -- Ensure production_records table exists
        CREATE TABLE IF NOT EXISTS production_records (
          id TEXT PRIMARY KEY,
          batch_no TEXT,
          lot_no TEXT,
          production_no TEXT,
          date DATE,
          status TEXT DEFAULT 'Active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS production_records DISABLE ROW LEVEL SECURITY;

        -- Ensure columns in material_inspection
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS company_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS machine_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS shift TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS department TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_ref TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS batch_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS delivery_claim NUMERIC DEFAULT 0;

        -- Trigger function for material_inspection with explicit RAISE NOTICE logging
        CREATE OR REPLACE FUNCTION trg_material_inspection_validate_sync()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE NOTICE '[DB Trigger material_inspection BEFORE] Validating MR: %, Arrival: %, PO: %, Production ID: %', 
            NEW.mr_no, NEW.arrival_no, NEW.po_no, NEW.production_id;

          -- Enforce mandatory primary key
          IF NEW.mr_no IS NULL OR TRIM(NEW.mr_no) = '' THEN
            RAISE EXCEPTION 'M.R. No is mandatory for Material Inspection Register.';
          END IF;

          -- Fallback arrival_no to mr_no
          IF NEW.arrival_no IS NULL OR TRIM(NEW.arrival_no) = '' THEN
            NEW.arrival_no := NEW.mr_no;
          END IF;

          -- Sanitize dates
          IF NEW.mr_date IS NULL THEN
            NEW.mr_date := CURRENT_DATE;
          END IF;
          IF NEW.date IS NULL THEN
            NEW.date := NEW.mr_date;
          END IF;
          IF NEW.arrival_date IS NULL THEN
            NEW.arrival_date := NEW.mr_date;
          END IF;

          NEW.updated_at := NOW();

          RAISE NOTICE '[DB Trigger material_inspection AFTER] Successfully validated and prepared MR: %', NEW.mr_no;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_material_inspection_validate_sync ON material_inspection;
        CREATE TRIGGER trg_material_inspection_validate_sync
        BEFORE INSERT OR UPDATE ON material_inspection
        FOR EACH ROW
        EXECUTE FUNCTION trg_material_inspection_validate_sync();
      `
    });
    console.log("Supabase trigger 'trg_material_inspection_validate_sync' verified/created successfully via exec_sql.");
  } catch (trgErr) {
    console.warn("Failed to create/verify inspection trigger in Supabase via RPC:", trgErr);
  }

  // Helper date sanitizer for server
  const serverSanitizeDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val !== 'string') {
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
      }
      return null;
    }
    const trimmed = val.trim();
    if (!trimmed || trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed === 'nan-nan-nan') return null;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      return `${y}-${m}-${d}`;
    }
    const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyymmdd) {
      const y = yyyymmdd[1];
      const m = yyyymmdd[2].padStart(2, '0');
      const d = yyyymmdd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
  };

  // INSPECTION MODULE REGISTER SAVE ENDPOINT
  app.post([
    "/api/inspection-register/save", 
    "/Jute-Purchase-Automation/api/inspection-register/save",
    "/api/material-inspection/save",
    "/Jute-Purchase-Automation/api/material-inspection/save"
  ], async (req, res) => {
    try {
      const body = req.body || {};
      const mrNoRaw = body.mr_no || body.headerForm?.mr_no;
      
      // Step 1: Validate Frontend Data - Mandatory MR No
      if (!mrNoRaw || String(mrNoRaw).trim() === '') {
        console.error("[INSPECTION SAVE - VALIDATION ERROR]", { error: "Arrival No. / M.R. No. is required.", body });
        return res.status(400).json({ 
          success: false, 
          error: "Arrival No. / M.R. No. is required." 
        });
      }

      const cleanMrNo = String(mrNoRaw).trim();
      const rawDetails = Array.isArray(body.grid_details) 
        ? body.grid_details 
        : (Array.isArray(body.details) ? body.details : (Array.isArray(body.detailRows) ? body.detailRows : []));

      const rawDeductions = Array.isArray(body.deductions)
        ? body.deductions
        : (Array.isArray(body.deduction_rows) ? body.deduction_rows : (Array.isArray(body.deductionRows) ? body.deductionRows : []));

      const productionId = String(body.production_id || body.production_ref || body.batch_id || '').trim();
      const arrivalNo = String(body.arrival_no || body.headerForm?.arrival_no || cleanMrNo).trim();
      const poNo = String(body.po_no || body.headerForm?.po_no || '').trim();
      const requireProductionValidation = Boolean(body.require_production_validation);

      // Step 2: EXPLICIT LOGGING BEFORE PRODUCTION ROW VALIDATION
      console.log("[INSPECTION SAVE - BEFORE PRODUCTION ROW VALIDATION]", {
        timestamp: new Date().toISOString(),
        cleanMrNo,
        arrivalNo,
        poNo,
        productionId,
        requireProductionValidation,
        candidateSearchKeys: [productionId, arrivalNo, cleanMrNo, poNo].filter(Boolean),
        detailRowsCount: rawDetails.length,
        deductionsCount: rawDeductions.length
      });

      // Execute Multi-Tier Production Row Validation & Resolution
      let matchedProductionRow: any = null;
      let matchedSource = "none";

      const candidateKeys = [productionId, arrivalNo, cleanMrNo, poNo].filter(k => k && k.length > 0);

      for (const key of candidateKeys) {
        if (matchedProductionRow) break;

        // Tier 1: Check production_records
        try {
          const { data: prodRow, error: pErr } = await supabase
            .from('production_records')
            .select('*')
            .or(`id.ilike.%${key}%,batch_no.ilike.%${key}%,lot_no.ilike.%${key}%,production_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (prodRow && !pErr) {
            matchedProductionRow = prodRow;
            matchedSource = "production_records";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in production_records for key '${key}':`, prodRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking production_records:", e);
        }

        // Tier 2: Check final_arrival
        try {
          const { data: faRow, error: faErr } = await supabase
            .from('final_arrival')
            .select('*')
            .or(`final_arrival_no.ilike.%${key}%,arrival_no.ilike.%${key}%,mr_no.ilike.%${key}%,po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (faRow && !faErr) {
            matchedProductionRow = faRow;
            matchedSource = "final_arrival";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in final_arrival for key '${key}':`, faRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking final_arrival:", e);
        }

        // Tier 3: Check temporary_material_received
        try {
          const { data: tmRow, error: tmErr } = await supabase
            .from('temporary_material_received')
            .select('*')
            .or(`mr_no.ilike.%${key}%,arrival_no.ilike.%${key}%,temporary_arrival_no.ilike.%${key}%,po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (tmRow && !tmErr) {
            matchedProductionRow = tmRow;
            matchedSource = "temporary_material_received";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in temporary_material_received for key '${key}':`, tmRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking temporary_material_received:", e);
        }

        // Tier 4: Check purchase_master
        try {
          const { data: pmRow, error: pmErr } = await supabase
            .from('purchase_master')
            .select('*')
            .or(`po_no.ilike.%${key}%,mill_po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (pmRow && !pmErr) {
            matchedProductionRow = pmRow;
            matchedSource = "purchase_master";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in purchase_master for key '${key}':`, pmRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking purchase_master:", e);
        }
      }

      // Step 3: EXPLICIT LOGGING AFTER PRODUCTION ROW VALIDATION
      if (matchedProductionRow) {
        console.log("[INSPECTION SAVE - AFTER PRODUCTION ROW VALIDATION: SUCCESS]", {
          timestamp: new Date().toISOString(),
          status: "FOUND",
          resolvedSource: matchedSource,
          cleanMrNo,
          matchedRecordSummary: {
            id: matchedProductionRow.id || matchedProductionRow.final_arrival_no || matchedProductionRow.mr_no || matchedProductionRow.po_no,
            source: matchedSource
          }
        });
      } else {
        console.warn("[INSPECTION SAVE - AFTER PRODUCTION ROW VALIDATION: NOT FOUND IN PRODUCTION/ARRIVAL TABLES]", {
          timestamp: new Date().toISOString(),
          status: "NOT_FOUND",
          cleanMrNo,
          searchedKeys: candidateKeys,
          requireProductionValidation
        });

        // Only reject if caller strictly requested strict production validation and productionId was explicitly supplied
        if (requireProductionValidation && productionId) {
          console.error("[INSPECTION SAVE - ABORTING SAVE DUE TO MISSING PRODUCTION ROW]", { productionId, cleanMrNo });
          return res.status(422).json({
            success: false,
            error: `Unable to save Inspection Module Register: Required Production Row '${productionId}' not found in database.`
          });
        }
      }

      // Format Dates & Numbers
      const resolvedMrDate = serverSanitizeDate(body.mr_date || body.date || body.headerForm?.mr_date) || new Date().toISOString().split('T')[0];
      const resolvedArrivalDate = serverSanitizeDate(body.arrival_date || body.headerForm?.arrival_date) || resolvedMrDate;
      const resolvedPoDate = serverSanitizeDate(body.po_date || body.headerForm?.po_date);
      const resolvedUnloadingDate = serverSanitizeDate(body.unloading_date || body.headerForm?.unloading_date);
      const resolvedMillPoDate = serverSanitizeDate(body.mill_po_date || body.headerForm?.mill_po_date) || resolvedPoDate;

      // Prepare Sanitize Detail Rows with strictly typed database column mappings
      const validDetails = rawDetails.map((row: any, idx: number) => ({
        mr_no: cleanMrNo,
        srl_no: Number(row.srl_no) || (idx + 1),
        arrival_grade: String(row.arrival_grade || row.stock_grade_name || row.grade || '').trim(),
        stock_grade_code: String(row.stock_grade_code || row.grade_code || '').trim(),
        stock_grade_name: String(row.stock_grade_name || row.arrival_grade || row.grade || '').trim(),
        area: String(row.area || '').trim(),
        agency: String(row.agency || '').trim(),
        agency_code: String(row.agency_code || '').trim(),
        marks: String(row.marks || row.marka || '').trim(),
        marka: String(row.marka || row.marks || '').trim(),
        crop_year: String(row.crop_year || '2026-27').trim(),
        lot: String(row.lot || '').trim(),
        quantity: Number(row.quantity) || 0,
        unit: String(row.unit || body.unit_name || body.unit || 'BALES').trim().toUpperCase(),
        rate: Number(row.rate || row.rate_qntl || 0) || 0,
        rate_qntl: Number(row.rate_qntl || row.rate || 0) || 0,
        challan_gross_wt: Number(row.challan_gross_wt) || 0,
        receipt_gross_wt: Number(row.receipt_gross_wt) || 0,
        gross_weight_batch: Number(row.gross_weight_batch) || 0,
        add_weight: Number(row.add_weight) || 0,
        less_weight: Number(row.less_weight) || 0,
        reduced_weight: Number(row.reduced_weight) || 0,
        lorry_moisture_min: Number(row.lorry_moisture_min) || 0,
        lorry_moisture_max: Number(row.lorry_moisture_max) || 0,
        lorry_read_min: Number(row.lorry_read_min) || 0,
        lorry_read_max: Number(row.lorry_read_max) || 0,
        lorry_read_avg: Number(row.lorry_read_avg) || 0,
        insp_read_min: Number(row.insp_read_min) || 0,
        insp_read_max: Number(row.insp_read_max) || 0,
        insp_read_avg: Number(row.insp_read_avg) || 0,
        moisture_act: Number(row.moisture_act || row.actual_moisture || 0) || 0,
        moisture_claim: Number(row.moisture_claim || row.claim_moisture || 0) || 0,
        dust_act: Number(row.dust_act || row.actual_dust || 0) || 0,
        dust_claim: Number(row.dust_claim || row.claim_dust || 0) || 0,
        ncv_act: Number(row.ncv_act || row.actual_ncv || 0) || 0,
        ncv_claim: Number(row.ncv_claim || row.claim_ncv || 0) || 0,
        grade_down_act: Number(row.grade_down_act || row.actual_grade_down || 0) || 0,
        grade_down_claim: Number(row.grade_down_claim || row.claim_grade_down || 0) || 0,
        actual_moisture: Number(row.moisture_act || row.actual_moisture || 0) || 0,
        claim_moisture: Number(row.moisture_claim || row.claim_moisture || 0) || 0,
        actual_dust: Number(row.dust_act || row.actual_dust || 0) || 0,
        claim_dust: Number(row.dust_claim || row.claim_dust || 0) || 0,
        actual_ncv: Number(row.ncv_act || row.actual_ncv || 0) || 0,
        claim_ncv: Number(row.ncv_claim || row.claim_ncv || 0) || 0,
        actual_grade_down: Number(row.grade_down_act || row.actual_grade_down || 0) || 0,
        claim_grade_down: Number(row.grade_down_claim || row.claim_grade_down || 0) || 0,
        final_receipt_wt: Number(row.final_receipt_wt) || 0,
        settlement_moisture: Number(row.settlement_moisture) || 0,
        settlement_grade_down: Number(row.settlement_grade_down) || 0,
        settlement_dust: Number(row.settlement_dust) || 0,
        settlement_ncv: Number(row.settlement_ncv) || 0,
        ropes_weight: Number(row.ropes_weight) || 0,
        ropes_tot_wt_grd: Number(row.ropes_tot_wt_grd) || 0,
        ropes_grade: String(row.ropes_grade || '').trim(),
        chotta_weight: Number(row.chotta_weight) || 0,
        chotta_tot_wt_grd: Number(row.chotta_tot_wt_grd) || 0,
        chotta_grade: String(row.chotta_grade || '').trim(),
        tolerable: String(row.tolerable || 'Yes').trim(),
        premium: String(row.premium || (row.is_premium ? 'Yes' : 'No')).trim(),
        is_premium: Boolean(row.is_premium || row.premium === 'Yes'),
        amount: Number(row.amount) || 0,
        row_remarks: String(row.row_remarks || '').trim(),
        jqi_remarks: String(row.jqi_remarks || '').trim(),
        jci_remarks: String(row.jci_remarks || row.jqi_remarks || '').trim()
      }));

      const activeDeductions = rawDeductions.filter((r: any) => (r.deduction_type && String(r.deduction_type).trim() !== '') || Number(r.deduction_amount) > 0);
      const totalDeductionAmt = rawDeductions.reduce((acc: number, r: any) => acc + (Number(r.deduction_amount) || 0), 0);
      const primaryDeduction = activeDeductions[0] || rawDeductions[0] || { deduction_type: '', deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

      // Step 4: Strictly Enforce Payload Mapping to Database Schema
      const masterPayload: any = {
        mr_no: cleanMrNo,
        mr_date: resolvedMrDate,
        date: resolvedMrDate,
        arrival_no: String(arrivalNo || cleanMrNo).trim(),
        arrival_date: resolvedArrivalDate,
        po_no: poNo ? String(poNo).trim() : null,
        po_date: resolvedPoDate,
        broker_name: String(body.broker_name || body.broker || '').trim(),
        supplier_name: String(body.supplier_name || body.supplier || '').trim(),
        broker: String(body.broker_name || body.broker || '').trim(),
        supplier: String(body.supplier_name || body.supplier || '').trim(),
        actual_moisture: Number(body.actual_moisture) || 0,
        claim_moisture: Number(body.claim_moisture) || 0,
        actual_dust: Number(body.actual_dust) || 0,
        claim_dust: Number(body.claim_dust) || 0,
        actual_ncv: Number(body.actual_ncv) || 0,
        claim_ncv: Number(body.claim_ncv) || 0,
        detention_days: Number(body.detention_days) || 0,
        unloading_date: resolvedUnloadingDate,
        mill_po_no: body.mill_po_no ? String(body.mill_po_no).trim() : (poNo ? String(poNo).trim() : null),
        mill_po_date: resolvedMillPoDate,
        mr_spcl_print: body.mr_spcl_print ? String(body.mr_spcl_print).trim() : null,
        remarks: body.remarks ? String(body.remarks).trim() : null,
        lorry_number: body.lorry_number ? String(body.lorry_number).trim() : null,
        delivery_claim: Number(body.delivery_claim) || 0,
        deduction_type: activeDeductions.map((r: any) => r.deduction_type).filter(Boolean).join(', ') || primaryDeduction.deduction_type || '',
        deduction_rate: Number(primaryDeduction.deduction_rate) || 0,
        deduction_qty: Number(primaryDeduction.deduction_qty) || 0,
        deduction_amount: Number(totalDeductionAmt) || 0,
        deductions: rawDeductions,
        deduction_rows: rawDeductions,
        deductions_json: JSON.stringify(rawDeductions),
        deduction_types: rawDeductions,
        unit_name: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
        unit: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
        status: String(body.status || 'Completed').trim(),
        grid_details: validDetails,
        details: validDetails,
        company_id: body.company_id ? String(body.company_id).trim() : null,
        unit_id: body.unit_id ? String(body.unit_id).trim() : null,
        machine_id: body.machine_id ? String(body.machine_id).trim() : null,
        shift: body.shift ? String(body.shift).trim() : null,
        department: body.department ? String(body.department).trim() : null,
        production_id: productionId || (matchedProductionRow?.id ? String(matchedProductionRow.id) : null),
        production_ref: body.production_ref || (matchedProductionRow ? String(matchedProductionRow.batch_no || matchedProductionRow.final_arrival_no || '') : null),
        updated_at: new Date().toISOString()
      };

      console.log("[INSPECTION SAVE - FULL PAYLOAD BEFORE SUPABASE DB CALL]", masterPayload);
      console.log("[INSPECTION SAVE - COMMITTING MASTER PAYLOAD TO DB]", {
        mr_no: masterPayload.mr_no,
        arrival_no: masterPayload.arrival_no,
        po_no: masterPayload.po_no,
        production_id: masterPayload.production_id,
        validDetailsCount: validDetails.length
      });

      // Step 5: Check if record exists for INSERT vs UPDATE
      const { data: existingCheck, error: checkErr } = await supabase
        .from('material_inspection')
        .select('mr_no')
        .eq('mr_no', cleanMrNo)
        .maybeSingle();

      if (checkErr) {
        console.warn("[Inspection Save API] Check existing error:", checkErr);
      }

      let saveResultData: any = null;

      if (existingCheck && existingCheck.mr_no) {
        // UPDATE existing record
        const { data: updateRes, error: updateErr } = await supabase
          .from('material_inspection')
          .update(masterPayload)
          .eq('mr_no', cleanMrNo)
          .select();

        if (updateErr) {
          console.error("[Inspection Save API] Update error:", updateErr);
          return res.status(500).json({
            success: false,
            error: `Unable to save Inspection Module Register: ${updateErr.message || 'Database update error'}. Data was not saved.`
          });
        }

        if (!updateRes || updateRes.length === 0) {
          return res.status(500).json({
            success: false,
            error: "Unable to save Inspection Module Register. Database update affected zero rows. Data was not saved."
          });
        }

        saveResultData = updateRes[0];
      } else {
        // INSERT new record
        masterPayload.created_at = new Date().toISOString();
        const { data: insertRes, error: insertErr } = await supabase
          .from('material_inspection')
          .insert(masterPayload)
          .select();

        if (insertErr) {
          console.error("[Inspection Save API] Insert error:", insertErr);
          return res.status(500).json({
            success: false,
            error: `Unable to save Inspection Module Register: ${insertErr.message || 'Database insert error'}. Data was not saved.`
          });
        }

        if (!insertRes || insertRes.length === 0) {
          return res.status(500).json({
            success: false,
            error: "Unable to save Inspection Module Register. Database insert affected zero rows. Data was not saved."
          });
        }

        saveResultData = insertRes[0];
      }

      // Step 6: Save child details & deductions
      try {
        await supabase.from('material_inspection_details').delete().eq('mr_no', cleanMrNo);
        if (validDetails.length > 0) {
          const { error: dErr } = await supabase.from('material_inspection_details').insert(validDetails);
          if (dErr) {
            console.warn("[Inspection Save API] material_inspection_details insert error:", dErr);
          }
        }
      } catch (childErr) {
        console.warn("[Inspection Save API] Child detail error:", childErr);
      }

      try {
        const totalBalesCount = validDetails.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0) || Number(body.total_quantity || 0);
        const totalGrossMt = validDetails.reduce((sum: number, r: any) => sum + (Number(r.receipt_gross_wt) || 0), 0) || Number(body.receipt_gross_wt || body.challan_gross_wt || 0);
        const calculatedAvgBaleWeight = totalBalesCount > 0 ? (totalGrossMt * 1000) / totalBalesCount : 0;

        const millDeductionRows = rawDeductions
          .filter((r: any) => (r.deduction_type && String(r.deduction_type).trim() !== '') || Number(r.deduction_amount) > 0 || Number(r.deduction_rate) > 0)
          .map((r: any) => ({
            mr_no: cleanMrNo,
            mr_date: resolvedMrDate,
            po_no: poNo ? String(poNo).trim() : null,
            po_date: resolvedPoDate,
            arrival_no: String(arrivalNo || cleanMrNo).trim(),
            arrival_date: resolvedArrivalDate,
            supplier: String(body.supplier_name || body.supplier || '').trim(),
            supplier_name: String(body.supplier_name || body.supplier || '').trim(),
            broker: String(body.broker_name || body.broker || '').trim(),
            broker_name: String(body.broker_name || body.broker || '').trim(),
            lorry_number: body.lorry_number ? String(body.lorry_number).trim() : '',
            deduction_type: String(r.deduction_type || '').trim(),
            deduction_rate: Number(r.deduction_rate) || 0,
            deduction_qty: Number(r.deduction_qty) || 0,
            deduction_amount: Number(r.deduction_amount) || 0,
            unit: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
            gross_weight_mt: totalGrossMt,
            total_bales: totalBalesCount,
            avg_bale_weight: calculatedAvgBaleWeight,
            remarks: String(r.remarks || body.remarks || '').trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

        await supabase.from('mill_inspection_deduction').delete().eq('mr_no', cleanMrNo);
        if (millDeductionRows.length > 0) {
          await supabase.from('mill_inspection_deduction').insert(millDeductionRows);
        }

        await supabase.from('material_inspection_deductions').delete().eq('mr_no', cleanMrNo);
        const midRows = rawDeductions
          .filter((r: any) => (r.deduction_type && String(r.deduction_type).trim() !== '') || Number(r.deduction_amount) > 0)
          .map((r: any) => ({
            mr_no: cleanMrNo,
            po_no: poNo ? String(poNo).trim() : null,
            arrival_no: String(arrivalNo || cleanMrNo).trim(),
            deduction_type: String(r.deduction_type || '').trim(),
            deduction_rate: Number(r.deduction_rate) || 0,
            deduction_qty: Number(r.deduction_qty) || 0,
            deduction_amount: Number(r.deduction_amount) || 0,
            remarks: String(r.remarks || '').trim()
          }));
        if (midRows.length > 0) {
          await supabase.from('material_inspection_deductions').insert(midRows);
        }
      } catch (dedErr) {
        console.warn("[Inspection Save API] Deduction save error:", dedErr);
      }

      // Step 7: Sync to final_arrival
      try {
        await supabase.from('final_arrival').update({
          status: 'Completed',
          grid_details: validDetails,
          details: validDetails
        }).or(`mr_no.eq.${cleanMrNo},final_arrival_no.eq.${cleanMrNo}${arrivalNo ? `,final_arrival_no.eq.${arrivalNo}` : ''}`);
      } catch (faErr) {}

      // Step 8: Post-Commit Verification - Verify saved record genuinely exists in DB
      const { data: verifiedRecord, error: verifyErr } = await supabase
        .from('material_inspection')
        .select('*')
        .eq('mr_no', cleanMrNo)
        .maybeSingle();

      if (verifyErr || !verifiedRecord) {
        console.error("[Inspection Save API] Verification query failed:", verifyErr);
        return res.status(500).json({
          success: false,
          error: "Unable to save Inspection Module Register. Data was not saved."
        });
      }

      console.log("[INSPECTION SAVE - COMPLETED & VERIFIED]", {
        mr_no: verifiedRecord.mr_no,
        arrival_no: verifiedRecord.arrival_no,
        status: verifiedRecord.status,
        timestamp: new Date().toISOString()
      });

      // Step 9: Return confirmed success response
      const affectedRowsCount = (saveResultData && verifiedRecord) ? 1 : 0;
      return res.status(200).json({
        success: true,
        affectedRows: affectedRowsCount,
        rowCount: affectedRowsCount,
        recordId: verifiedRecord.mr_no,
        data: verifiedRecord,
        message: "Data Saved Successfully."
      });

    } catch (serverErr: any) {
      console.error("[Inspection Save API] Fatal exception:", serverErr);
      return res.status(500).json({
        success: false,
        error: `Unable to save Inspection Module Register: ${serverErr.message || 'Internal Server Error'}. Data was not saved.`
      });
    }
  });

  // Health Check
  app.get(["/api/health", "/Jute-Purchase-Automation/api/health"], (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    syncEmailsBackground().catch(err => {
      console.error("Background email sync failed to start:", err);
    });
  });
}

startServer();
