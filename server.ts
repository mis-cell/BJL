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
