import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { apiAccessGate } from "@workspace/app-access";

const app: Express = express();

// pg removes failed idle clients and reconnects on the next query. An unhandled
// pool error instead terminates the entire API after a database interruption.
pool.on("error", error => {
  logger.error({
    code: "code" in error ? String(error.code) : undefined,
    message: error.message,
  }, "Idle database connection interrupted; subsequent requests will reconnect");
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Enforce app access before JSON parsing or any data routes.
app.use(apiAccessGate);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
