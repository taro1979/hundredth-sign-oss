/**
 * Client IP Address Extraction Utility
 *
 * Safely extracts the real client IP from an HTTP request, accounting for
 * reverse proxies and load balancers.
 *
 * Security considerations:
 * - `x-forwarded-for` and `x-real-ip` headers can be spoofed by the client.
 * - We only trust these headers when the request arrives through a known
 *   trusted proxy, as configured by the `TRUST_PROXY` environment variable.
 * - When proxies are NOT trusted, we fall back to `req.socket.remoteAddress`,
 *   which is the TCP-level peer address and cannot be spoofed.
 *
 * Configuration via ENV.trustProxy:
 *   "true" / "1"       → trust all proxies (single LB in front)
 *   "false" / "0" / "" → never trust forwarded headers
 *   "10.0.0.0/8,..."   → trust only listed CIDRs / IPs (advanced)
 */

import { ENV } from "./_core/env";
import type { IncomingMessage } from "http";
import { isIP } from "net";

// ==================== CIDR Matching ====================

interface CidrRange {
  ip: number[];
  prefixLen: number;
  version: 4 | 6;
}

/**
 * Parse an IPv4 address into a 4-element numeric array.
 */
function parseIPv4(addr: string): number[] | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

/**
 * Parse an IPv6 address into an 8-element 16-bit array.
 * Supports :: expansion and IPv4-mapped addresses.
 */
function parseIPv6(addr: string): number[] | null {
  // Handle IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const v4Mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped) {
    const v4 = parseIPv4(v4Mapped[1]);
    if (!v4) return null;
    return [0, 0, 0, 0, 0, 0xffff, (v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : [];
  const missing = 8 - left.length - right.length;

  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 0) return null;

  const full = [
    ...left.map(h => parseInt(h, 16)),
    ...Array(halves.length === 2 ? missing : 0).fill(0),
    ...right.map(h => parseInt(h, 16)),
  ];

  if (full.length !== 8 || full.some(n => isNaN(n) || n < 0 || n > 0xffff)) return null;
  return full;
}

/**
 * Parse a CIDR notation string into a CidrRange.
 */
function parseCidr(cidr: string): CidrRange | null {
  const [addr, prefixStr] = cidr.split("/");
  if (!addr) return null;

  const v4 = parseIPv4(addr);
  if (v4) {
    const prefixLen = prefixStr ? parseInt(prefixStr, 10) : 32;
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
    return { ip: v4, prefixLen, version: 4 };
  }

  const v6 = parseIPv6(addr);
  if (v6) {
    const prefixLen = prefixStr ? parseInt(prefixStr, 10) : 128;
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) return null;
    return { ip: v6, prefixLen, version: 6 };
  }

  return null;
}

/**
 * Check if an IP address falls within a CIDR range.
 */
function ipInCidr(ipStr: string, cidr: CidrRange): boolean {
  let ipNums: number[] | null;
  let bitsPerElement: number;

  if (cidr.version === 4) {
    ipNums = parseIPv4(ipStr);
    bitsPerElement = 8;
  } else {
    ipNums = parseIPv6(ipStr);
    bitsPerElement = 16;
  }

  if (!ipNums || ipNums.length !== cidr.ip.length) return false;

  let remainingBits = cidr.prefixLen;
  for (let i = 0; i < ipNums.length && remainingBits > 0; i++) {
    const bits = Math.min(remainingBits, bitsPerElement);
    const mask = bits === bitsPerElement
      ? (1 << bitsPerElement) - 1
      : ((1 << bits) - 1) << (bitsPerElement - bits);

    if ((ipNums[i] & mask) !== (cidr.ip[i] & mask)) return false;
    remainingBits -= bits;
  }

  return true;
}

// ==================== Trust Configuration ====================

type TrustMode =
  | { type: "all" }
  | { type: "none" }
  | { type: "cidrs"; ranges: CidrRange[] };

let _trustMode: TrustMode | null = null;

function getTrustMode(): TrustMode {
  if (_trustMode) return _trustMode;

  const raw = ENV.trustProxy.trim().toLowerCase();

  if (raw === "true" || raw === "1") {
    _trustMode = { type: "all" };
  } else if (raw === "false" || raw === "0" || raw === "") {
    _trustMode = { type: "none" };
  } else {
    // Parse as comma-separated CIDR list
    const ranges = raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(parseCidr)
      .filter((r): r is CidrRange => r !== null);

    _trustMode = ranges.length > 0 ? { type: "cidrs", ranges } : { type: "none" };
  }

  return _trustMode;
}

/**
 * Determine whether the direct connection peer (remoteAddress) is a
 * trusted proxy, and therefore its forwarded headers can be believed.
 */
function isProxyTrusted(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;

  const mode = getTrustMode();

  switch (mode.type) {
    case "all":
      return true;
    case "none":
      return false;
    case "cidrs": {
      // Normalize IPv6-mapped IPv4
      const normalized = remoteAddress.startsWith("::ffff:")
        ? remoteAddress.slice(7)
        : remoteAddress;
      return mode.ranges.some(cidr => ipInCidr(normalized, cidr));
    }
  }
}

// ==================== Public API ====================

/**
 * Safely extract the client IP address from an HTTP request.
 *
 * - If the direct peer is a trusted proxy, use the leftmost entry in
 *   `x-forwarded-for` (the original client IP set by the first proxy).
 * - Otherwise, fall back to `req.socket.remoteAddress`.
 *
 * The returned value is sanitized:
 * - IPv6-mapped IPv4 addresses are normalized to plain IPv4.
 * - Invalid / non-IP strings are discarded.
 */
export function getClientIp(req: IncomingMessage): string | null {
  const remoteAddress = req.socket?.remoteAddress ?? null;

  if (isProxyTrusted(remoteAddress ?? undefined)) {
    // Trust forwarded headers
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const candidate = forwarded.split(",")[0]?.trim();
      if (candidate && isValidIp(candidate)) {
        return normalizeIp(candidate);
      }
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      const candidate = forwarded[0]?.trim();
      if (candidate && isValidIp(candidate)) {
        return normalizeIp(candidate);
      }
    }

    // Fallback: x-real-ip (set by some proxies like nginx)
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && isValidIp(realIp.trim())) {
      return normalizeIp(realIp.trim());
    }
  }

  // Not behind a trusted proxy — use the TCP peer address
  return remoteAddress ? normalizeIp(remoteAddress) : null;
}

// ==================== Helpers ====================

/**
 * Validate that a string looks like a valid IP address.
 * Prevents log injection via crafted x-forwarded-for values.
 */
function isValidIp(value: string): boolean {
  return isIP(value) !== 0;
}

/**
 * Normalize an IP address:
 * - Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4 → 1.2.3.4)
 */
function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    const v4Part = ip.slice(7);
    if (isIP(v4Part) === 4) return v4Part;
  }
  return ip;
}

/**
 * Reset the cached trust mode (for testing).
 */
export function _resetTrustMode(): void {
  _trustMode = null;
}
