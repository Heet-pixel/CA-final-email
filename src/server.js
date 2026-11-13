const os = require("os");
const app = require("./app");
const cfg = require("./config");

/** Wi-Fi / LAN addresses of this computer, so the site can be opened on a phone on the same network. */
function lanUrls(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === "IPv4" && !i.internal) out.push(`http://${i.address}:${port}`);
  }
  return out;
}

const server = app.listen(cfg.port, "0.0.0.0", () => {
  console.log("");
  console.log(`AVKAS & Co. – website + API running (${cfg.isProd ? "production" : "development"})`);
  console.log(`  Open on this computer :  http://localhost:${cfg.port}`);
  const lan = lanUrls(cfg.port);
  if (lan.length) console.log(`  Open on your phone    :  ${lan.join("   or   ")}   (phone must be on the same Wi-Fi)`);
  console.log(`  Health check          :  http://localhost:${cfg.port}/api/health`);
  console.log("");
  console.log(`  Mail region           :  ${cfg.aws.region}   From: ${cfg.ses.from || "(not set)"}   To: ${cfg.ses.to.join(", ") || "(not set)"}`);
  if (cfg.missing.length) console.warn(`WARNING – missing settings in .env, form emails will be refused: ${cfg.missing.join(", ")}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`Port ${cfg.port} is already in use. Close the other program, or set another PORT in .env`);
  else console.error(err);
  process.exit(1);
});

// Render stops the instance with SIGTERM – finish in-flight requests first.
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
