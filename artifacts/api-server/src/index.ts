import app from "./app";
import { logger } from "./lib/logger";
import { ensurePublicHousingExamples } from "./lib/housing-showcase";
import { pool } from "@workspace/db";

// Idle clients can disconnect during a database restart. pg removes those clients
// from the pool; handling its error event prevents an unrelated server crash.
// Query failures still reject normally and are handled by the request routes.
pool.on("error", (error: Error & { code?: string }) => {
  logger.error(
    { code: error.code ?? "UNKNOWN" },
    "An idle database connection closed unexpectedly; the pool will replace it.",
  );
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  const inserted = await ensurePublicHousingExamples();
  logger.info({ inserted }, "Public housing examples available; existing records preserved");
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch(err => {
  logger.error({ err }, "Server startup failed while ensuring public housing examples");
  process.exit(1);
});
