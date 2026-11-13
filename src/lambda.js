/**
 * AWS Lambda entry point.   Handler:  src/lambda.js  ->  "src/lambda.handler"
 *
 * Works behind a Lambda Function URL (recommended) or an API Gateway HTTP API ($default stage).
 * The same Express app that runs locally (`npm start`) is used, so behaviour is identical:
 * it serves the website from /public AND the API (/api/*).
 */
const serverless = require("serverless-http");
const app = require("./app");

module.exports.handler = serverless(app, {
  // Lambda can only return text directly; these types must be base64-encoded in the response.
  binary: [
    "image/*",
    "video/*",
    "audio/*",
    "font/*",
    "application/font-woff",
    "application/font-woff2",
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/vnd.ms-fontobject",
  ],
});
