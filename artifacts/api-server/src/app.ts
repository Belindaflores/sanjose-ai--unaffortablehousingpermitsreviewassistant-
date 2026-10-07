import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
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
// Enforce app access before Clerk proxying, JSON parsing, or any data routes.
app.use(apiAccessGate);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use("/api", router);

export default app;
