// Local development: read .env. On AWS Lambda nothing is read from disk – the function's environment variables win.
const path = require("path");
// Load .env from the PROJECT ROOT no matter which folder you start the server from
// (plain config() only looks in the current working directory, which is a common reason "my .env is ignored").
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// True when running inside AWS Lambda (this variable is always set by the Lambda runtime).
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isProd = process.env.NODE_ENV === "production" || isLambda;

const list = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Always allowed: the Render test site and the final domain. CORS_ORIGINS can ADD more (comma separated).
const BUILT_IN_ORIGINS = [
  "https://avkas.onrender.com",
  "https://avkasco.com",
  "https://www.avkasco.com",
];
const origins = [
  ...new Set(
    [...BUILT_IN_ORIGINS, ...list(process.env.CORS_ORIGINS)].map((o) =>
      o.replace(/\/+$/, ""),
    ),
  ),
];
if (!isProd)
  for (const port of [3000, 5500, 8080])
    origins.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`); // local dev servers (npx serve, Live Server…)

// Mail provider: "smtp" (e.g. Gmail + App Password) when SMTP_USER is set, otherwise Amazon SES. Force with MAIL_PROVIDER=ses|smtp.
const smtpUser = (process.env.SMTP_USER || "").trim();
const provider = (process.env.MAIL_PROVIDER || (smtpUser ? "smtp" : "ses")).trim().toLowerCase();

const cfg = {
  provider,
  smtp: {
    host: (process.env.SMTP_HOST || "smtp.gmail.com").trim(),
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    user: smtpUser,
    // Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); they must be removed.
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  },
  isProd,
  isLambda,
  port: parseInt(process.env.PORT || "4000", 10),
  origins,
  // On Lambda, AWS_REGION is the function's own region (reserved, cannot be changed). If SES lives in a different
  // region than the function, set SES_REGION. Default for local runs: ap-south-1.
  //aws: { region: (process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1").trim() },
  aws: {
    region: (process.env.SES_REGION || "ap-south-1").trim(),
  },
  // How many proxy hops sit in front (Function URL / API Gateway = 1; CloudFront + API Gateway = 2).
  trustProxy: parseInt(process.env.TRUST_PROXY || "1", 10),
  ses: {
    from: ((provider === "smtp" ? process.env.SMTP_FROM || smtpUser : process.env.SES_FROM_EMAIL) || "").trim(),
    to: list(process.env.SES_TO_EMAIL),
    // Job applications can go to a different inbox (e.g. HR); falls back to SES_TO_EMAIL when not set.
    careerTo: list(process.env.SES_CAREER_TO_EMAIL).length
      ? list(process.env.SES_CAREER_TO_EMAIL)
      : list(process.env.SES_TO_EMAIL),
  },
  maxFileBytes: 5 * 1024 * 1024,
};

/** Names of missing settings (values are never logged). */
cfg.missing = (
  provider === "smtp"
    ? [!cfg.smtp.user && "SMTP_USER", !cfg.smtp.pass && "SMTP_PASS", !cfg.ses.to.length && "SES_TO_EMAIL"]
    : [
        // On Lambda the credentials come from the function's IAM role automatically – no keys needed.
        !isLambda && !process.env.AWS_ACCESS_KEY_ID && "AWS_ACCESS_KEY_ID",
        !isLambda && !process.env.AWS_SECRET_ACCESS_KEY && "AWS_SECRET_ACCESS_KEY",
        !cfg.ses.from && "SES_FROM_EMAIL",
        !cfg.ses.to.length && "SES_TO_EMAIL",
      ]
).filter(Boolean);

module.exports = cfg;
