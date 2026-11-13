const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const cfg = require("./config");

let client;
// Credentials: on Lambda they come from the function's IAM role automatically; locally from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env.
const ses = () => (client ||= new SESv2Client({ region: cfg.aws.region }));

/** Turn a raw SES/AWS error into a plain-English hint (printed in the server console only, never shown to visitors). */
function explain(err) {
  const n = (err && (err.name || err.Code)) || "";
  const m = (err && err.message) || "";
  if (err && err.code === "EAUTH") return "Gmail refused the login. SMTP_PASS must be a 16-character Google APP PASSWORD (not your normal password) and 2-Step Verification must be ON for SMTP_USER.";
  if (err && /ESOCKET|ECONNECTION|ETIMEDOUT/.test(err.code || "")) return "Cannot reach the SMTP server (port " + cfg.smtp.port + "). Your network/host may block SMTP (Render free plan does). Use SES on a verified domain there.";
  if (/MessageRejected/i.test(n) && /not verified/i.test(m)) return "SES is in SANDBOX or the address is not verified: verify SES_FROM_EMAIL AND every SES_TO_EMAIL address in this region, or request production access.";
  if (/MessageRejected/i.test(n)) return "SES rejected the message: " + m;
  if (/AccountSuspended|SendingPaused/i.test(n)) return "Your SES account/sending is paused. Check the SES console.";
  if (/InvalidClientTokenId|UnrecognizedClient|SignatureDoesNotMatch|InvalidSignature/i.test(n + m)) return "AWS keys are wrong (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). Re-copy them with no spaces or quotes.";
  if (/AccessDenied|not authorized/i.test(n + m)) return "The IAM user has no permission. Attach a policy that allows ses:SendEmail (and ses:SendRawEmail).";
  if (/NotFoundException|Email address is not verified|identity/i.test(n + m)) return "Sender identity not found in region " + cfg.aws.region + ". Verify it in the SAME region as SES_REGION.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(n + m)) return "No internet / DNS problem reaching AWS.";
  if (/Region/i.test(m)) return "Region problem. Set SES_REGION, e.g. ap-south-1.";
  return "";
}

let smtpTransport;
const smtp = () =>
  (smtpTransport ||= nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
    connectionTimeout: 15000,
    socketTimeout: 20000,
  }));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function body(fields) {
  const text = fields.map(([k, v]) => `${k}: ${v || "-"}`).join("\n");
  const html =
    `<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">` +
    fields
      .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#555;vertical-align:top"><b>${esc(k)}</b></td><td style="padding:6px 0">${esc(v || "-").replace(/\n/g, "<br>")}</td></tr>`)
      .join("") +
    `</table>`;
  return { text, html };
}

const utf8 = (Data) => ({ Data, Charset: "UTF-8" });

/** Contact enquiry – From is the verified SES identity, Reply-To is the visitor. */
async function sendContact(d) {
  const { text, html } = body([
    ["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Subject", d.subject], ["Message", d.message],
  ]);
  if (cfg.provider === "smtp") {
    const info = await smtp().sendMail({
      from: `"AVKAS & Co. Website" <${cfg.ses.from}>`,
      to: cfg.ses.to,
      replyTo: d.email,
      subject: d.subject ? `New Contact Enquiry: ${d.subject} - AVKAS & Co.`.slice(0, 250) : "New Contact Enquiry - AVKAS & Co.",
      text,
      html,
    });
    console.log("[mail] contact enquiry accepted by SMTP -> to:", cfg.ses.to.join(", "), "| from:", cfg.ses.from, "| id:", info.messageId);
    return info.messageId;
  }
  const out = await ses().send(
    new SendEmailCommand({
      FromEmailAddress: cfg.ses.from,
      Destination: { ToAddresses: cfg.ses.to },
      ReplyToAddresses: [d.email],
      Content: { Simple: { Subject: utf8(d.subject ? `New Contact Enquiry: ${d.subject} - AVKAS & Co.`.slice(0, 250) : "New Contact Enquiry - AVKAS & Co."), Body: { Text: utf8(text), Html: utf8(html) } } },
    })
  );
  console.log("[mail] contact enquiry accepted by SES -> to:", cfg.ses.to.join(", "), "| from:", cfg.ses.from, "| MessageId:", out.MessageId);
  return out.MessageId;
}

/** Career application – raw MIME so the resume can be attached. */
async function sendCareer(d, resume) {
  const { text, html } = body([
    ["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Position", d.position], ["Experience", d.experience], ["Message", d.message],
  ]);
  if (cfg.provider === "smtp") {
    const info = await smtp().sendMail({
      from: `"AVKAS & Co. Website" <${cfg.ses.from}>`,
      to: cfg.ses.careerTo,
      replyTo: d.email,
      subject: `New Career Application - ${d.position}`.slice(0, 200),
      text,
      html,
      attachments: [{ filename: resume.filename, content: resume.buffer }],
    });
    console.log("[mail] career application accepted by SMTP -> to:", cfg.ses.careerTo.join(", "), "| id:", info.messageId);
    return info.messageId;
  }
  const mime = new MailComposer({
    from: cfg.ses.from,
    to: cfg.ses.careerTo,
    replyTo: d.email,
    subject: `New Career Application - ${d.position}`.slice(0, 200),
    text,
    html,
    attachments: [{ filename: resume.filename, content: resume.buffer }],
  });
  const raw = await new Promise((resolve, reject) => mime.compile().build((e, m) => (e ? reject(e) : resolve(m))));
  const out = await ses().send(
    new SendEmailCommand({
      FromEmailAddress: cfg.ses.from,
      Destination: { ToAddresses: cfg.ses.careerTo },
      Content: { Raw: { Data: raw } },
    })
  );
  console.log("[mail] career application accepted by SES -> to:", cfg.ses.careerTo.join(", "), "| from:", cfg.ses.from, "| MessageId:", out.MessageId);
  return out.MessageId;
}

module.exports = { sendContact, sendCareer, explain };
