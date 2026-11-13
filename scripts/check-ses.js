/* Run:  npm run check:ses
   Looks at your Amazon SES account and tells you, in plain English, why an email may be "sent" but never arrive. */
const cfg = require("../src/config");
const { SESv2Client, GetAccountCommand, GetEmailIdentityCommand, GetSuppressedDestinationCommand } = require("@aws-sdk/client-sesv2");

const ses = new SESv2Client({ region: cfg.aws.region });
const ok = (m) => console.log("  [OK]   " + m);
const bad = (m) => console.log("  [FIX]  " + m);
const info = (m) => console.log("  [INFO] " + m);
const domainOf = (a) => (a.split("@")[1] || "").toLowerCase();
const FREE = ["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com"];

async function identity(name) {
  try { return await ses.send(new GetEmailIdentityCommand({ EmailIdentity: name })); }
  catch (e) { if (e.name === "NotFoundException") return null; throw e; }
}

(async () => {
  console.log(`\nRegion: ${cfg.aws.region}\nFrom  : ${cfg.ses.from}\nTo    : ${cfg.ses.to.join(", ")}\n`);
  if (cfg.missing.length) { bad("Missing in .env: " + cfg.missing.join(", ")); process.exit(1); }

  try {
    console.log("1) Account");
    const acc = await ses.send(new GetAccountCommand({}));
    acc.ProductionAccessEnabled ? ok("Production access is ON (you can email anyone).") : bad("SANDBOX mode: SES only delivers to VERIFIED addresses. Verify every address in SES_TO_EMAIL, or request production access in the SES console.");
    acc.SendingEnabled === false ? bad("Sending is DISABLED for this account/region.") : ok("Sending is enabled.");
    if (acc.SendQuota) info(`Sent last 24h: ${acc.SendQuota.SentLast24Hours} of ${acc.SendQuota.Max24HourSend}`);
  } catch (e) { info("Could not read account (" + e.name + "). Add ses:GetAccount to the IAM policy to see this check."); }

  console.log("\n2) Sender (From) address");
  const fromDomain = domainOf(cfg.ses.from);
  if (FREE.includes(fromDomain)) bad(`'${cfg.ses.from}' is a free mailbox (${fromDomain}). Gmail/Yahoo/Outlook reject or spam-folder mail that claims to be from their domain but is sent through SES (fails DMARC). This is the #1 reason SES says "sent" but nothing arrives. Verify your OWN domain (e.g. avkasco.com) in SES with DKIM and use no-reply@avkasco.com as SES_FROM_EMAIL.`);
  try {
    const id = (await identity(cfg.ses.from)) || (await identity(fromDomain));
    if (!id) bad(`Neither ${cfg.ses.from} nor ${fromDomain} is a verified identity in ${cfg.aws.region}.`);
    else {
      id.VerifiedForSendingStatus ? ok(`Verified identity found (${id.IdentityType}).`) : bad("Identity exists but is NOT verified yet. Click the link in the AWS verification email / add the DNS records.");
      if (id.IdentityType === "DOMAIN") id.DkimAttributes && id.DkimAttributes.Status === "SUCCESS" ? ok("DKIM is set up (good for inbox delivery).") : bad("DKIM not confirmed. Add the 3 CNAME records SES shows for the domain.");
    }
  } catch (e) { info("Could not check identity (" + e.name + "). Add ses:GetEmailIdentity to see this check."); }

  console.log("\n3) Recipients (To)");
  for (const to of cfg.ses.to) {
    try {
      const id = await identity(to);
      info(`${to}: ${id ? (id.VerifiedForSendingStatus ? "verified identity" : "identity NOT verified") : "not a separate identity (fine in production, blocked in sandbox)"}`);
    } catch (e) { info(`${to}: identity check skipped (${e.name})`); }
    try {
      await ses.send(new GetSuppressedDestinationCommand({ EmailAddress: to }));
      bad(`${to} is on the SES SUPPRESSION LIST (a past bounce/complaint). SES silently drops mail to it. Remove it in SES console > Suppression list.`);
    } catch (e) { if (e.name === "NotFoundException") ok(`${to} is not suppressed.`); else info(`${to}: suppression check skipped (${e.name})`); }
  }
  console.log("\nIf everything is OK and mail is still missing: search Spam/All Mail in the To inbox for 'AVKAS', and look at SES console > Virtual Deliverability / CloudWatch for Bounce or Complaint events.\n");
})().catch((e) => { console.error("Check failed:", e.name, "-", e.message); process.exit(1); });
