import { Request, Response, NextFunction } from "express";
import { join, resolve } from "path";
import { timingSafeEqual } from "crypto";

let logged = false;

function isValidBypassSecret(header: string, secret: string): boolean {
  if (!secret) return false;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Resolve maintenance page path for both dev and production environments.
// In production, esbuild compiles server to dist/index.js so import.meta.dirname = dist/.
// In development, source runs from server/_core/ so use process.cwd() instead.
function getMaintenancePagePath(): string {
  if (process.env.NODE_ENV === "production") {
    return resolve(import.meta.dirname, "public", "maintenance.html");
  }
  return join(process.cwd(), "client", "public", "maintenance.html");
}

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.MAINTENANCE_MODE !== "true") return next();

  // Log once on first request
  if (!logged) {
    console.log(JSON.stringify({ level: "info", module: "Maintenance", message: "Maintenance mode is active — returning 503 for all requests" }));
    logged = true;
  }

  // Always pass through health check
  if (req.path === "/api/health") return next();

  // Bypass via secret header (timing-safe comparison)
  const bypassSecret = process.env.MAINTENANCE_BYPASS_SECRET ?? "";
  const bypassHeader = String(req.headers["x-maintenance-bypass"] ?? "");
  if (bypassSecret && isValidBypassSecret(bypassHeader, bypassSecret)) return next();

  // Bypass via allowed IPs
  const allowedIps = (process.env.MAINTENANCE_ALLOWED_IPS ?? "")
    .split(",")
    .map(ip => ip.trim())
    .filter(Boolean);
  const clientIp = (req.ip ?? "").replace(/^::ffff:/, "");
  if (allowedIps.includes(clientIp)) return next();

  const retryAfter = process.env.MAINTENANCE_RETRY_AFTER ?? "3600";
  res.status(503).set("Retry-After", retryAfter);

  res.sendFile(getMaintenancePagePath(), (err) => {
    if (err && !res.headersSent) {
      res.status(503).send("Service temporarily unavailable. Please try again later.");
    }
  });
}
