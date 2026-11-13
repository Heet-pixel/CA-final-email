/* Run:  npm run test:mail   – sends ONE test email using your .env and prints the real reason if it fails. */
const cfg = require("../src/config");
const { sendContact, explain } = require("../src/mailer");

(async () => {
  console.log("Provider:", cfg.provider === "smtp" ? "SMTP (" + cfg.smtp.host + ")" : "Amazon SES (" + cfg.aws.region + ")");
  console.log("From   :", cfg.ses.from || "(missing)");
  console.log("To     :", cfg.ses.to.join(", ") || "(missing)");
  if (cfg.missing.length) {
    console.error("\nMissing in .env:", cfg.missing.join(", "));
    process.exit(1);
  }
  try {
    const id = await sendContact({ name: "Test", email: cfg.ses.from, phone: "0000000", subject: "Test email", message: "If you can read this, SES sending works." });
    console.log("\nSUCCESS – SES accepted the email. MessageId:", id, "\nCheck the inbox (and Spam) of:", cfg.ses.to.join(", "));
  } catch (e) {
    console.error("\nFAILED:", e.name, "-", e.message);
    const h = explain(e);
    if (h) console.error("HINT  :", h);
    process.exit(1);
  }
})();
