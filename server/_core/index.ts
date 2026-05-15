import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { join } from "path";
import { mkdirSync } from "fs";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduler";
import { checkMigrations } from "../checkMigrations";
import { globalLimiter, accessCodeLimiter } from "./rate-limit";
import { ENV } from "./env";
import { registerPdfProxyRoute } from "../pdfProxy";
import { maintenanceMiddleware } from "./maintenance";
import { registerIntegrationRoutes } from "../integrations";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Abort early if any DB migrations are pending
  await checkMigrations();

  const app = express();
  const server = createServer(app);
  // ── Maintenance mode (before all other middleware) ──
  app.use(maintenanceMiddleware);

  // ── Security headers (helmet) ──
  // Must be early — before static files and API routes
  const isDev = process.env.NODE_ENV !== "production";
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: isDev ? ["'self'", "ws:", "wss:"] : ["'self'"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isDev ? null : [],
        },
      },
      // HSTS: 1 year, include subdomains (production only — avoids breaking dev http)
      strictTransportSecurity: isDev ? false : { maxAge: 31536000, includeSubDomains: true },
      // Disable X-Powered-By: Express
      hidePoweredBy: true,
    })
  );


  // ── CORS (must be before body parsers so preflight OPTIONS is handled) ──
  const allowedOrigins: string[] = [];
  if (ENV.appUrl) allowedOrigins.push(ENV.appUrl);
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:5173");
  }
  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  }));

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Global rate limiter (production only — skip in test/development/e2e)
  if (process.env.NODE_ENV === "production") {
    app.use("/api", globalLimiter);
  }
  // Strict rate limit for access code verification endpoint (production only)
  if (process.env.NODE_ENV === "production") {
    app.use("/api/trpc/signature.verifyAccessCode", accessCodeLimiter);
  }
  // Local uploads — dev/test fallback when forge storage credentials are absent
  const localUploadsDir = join(process.cwd(), "tmp", "local-uploads");
  mkdirSync(localUploadsDir, { recursive: true });
  app.use("/local-uploads", express.static(localUploadsDir));
  // PDF proxy: decrypts AES-256-GCM encrypted PDFs from WORM storage
  registerPdfProxyRoute(app);
  // External integration REST API for third-party systems and CLI clients
  registerIntegrationRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  process.env.PORT = String(port);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start automatic reminder & expiration scheduler
    startScheduler();
  });
}

startServer().catch(console.error);
