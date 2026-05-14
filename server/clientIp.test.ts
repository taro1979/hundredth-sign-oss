import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage } from "http";

// We need to control ENV.trustProxy, so mock it
let mockTrustProxy = "false";
vi.mock("./_core/env", () => ({
  ENV: {
    get trustProxy() {
      return mockTrustProxy;
    },
  },
}));

import { getClientIp, _resetTrustMode } from "./clientIp";

function makeReq(overrides: {
  remoteAddress?: string | null;
  headers?: Record<string, string | string[] | undefined>;
}): IncomingMessage {
  return {
    socket: { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" },
    headers: overrides.headers ?? {},
  } as unknown as IncomingMessage;
}

describe("clientIp", () => {
  beforeEach(() => {
    _resetTrustMode();
    mockTrustProxy = "false";
  });

  // ========== Trust mode: "none" (default) ==========
  describe("trust mode = none", () => {
    it("returns remoteAddress when proxy not trusted", () => {
      const req = makeReq({ remoteAddress: "192.168.1.1" });
      expect(getClientIp(req)).toBe("192.168.1.1");
    });

    it("ignores x-forwarded-for when proxy not trusted", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("returns null when socket has no remoteAddress", () => {
      const req = { socket: {}, headers: {} } as unknown as IncomingMessage;
      expect(getClientIp(req)).toBeNull();
    });

    it('normalizes IPv6-mapped IPv4 from remoteAddress', () => {
      const req = makeReq({ remoteAddress: "::ffff:10.0.0.1" });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("returns raw IPv6 when not IPv4-mapped", () => {
      const req = makeReq({ remoteAddress: "::1" });
      expect(getClientIp(req)).toBe("::1");
    });

    it('handles trustProxy = "0"', () => {
      mockTrustProxy = "0";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it('handles trustProxy = "" (empty)', () => {
      mockTrustProxy = "";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });
  });

  // ========== Trust mode: "all" ==========
  describe("trust mode = all", () => {
    beforeEach(() => {
      mockTrustProxy = "true";
      _resetTrustMode();
    });

    it("uses x-forwarded-for when proxy is trusted", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("uses first IP from x-forwarded-for chain", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("normalizes IPv6-mapped IPv4 from x-forwarded-for", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "::ffff:203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("uses x-real-ip as fallback when x-forwarded-for missing", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-real-ip": "198.51.100.14" },
      });
      expect(getClientIp(req)).toBe("198.51.100.14");
    });

    it("falls back to remoteAddress when no forwarded headers", () => {
      const req = makeReq({ remoteAddress: "10.0.0.1", headers: {} });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("rejects invalid (non-IP) x-forwarded-for values", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "not-an-ip, also-not-ip" },
      });
      // Falls through to x-real-ip, then remoteAddress
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("rejects invalid x-real-ip values", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-real-ip": "inject<script>" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles x-forwarded-for as array", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": ["198.51.100.14", "70.41.3.18"] as any },
      });
      expect(getClientIp(req)).toBe("198.51.100.14");
    });

    it("handles x-forwarded-for as array with invalid first entry", () => {
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": ["not-ip"] as any },
      });
      // Falls through to x-real-ip, then remoteAddress
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it('handles trustProxy = "1"', () => {
      mockTrustProxy = "1";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("returns null when remoteAddress is missing (not trusted)", () => {
      // isProxyTrusted returns false when remoteAddress is undefined
      const req = { socket: {}, headers: { "x-forwarded-for": "1.2.3.4" } } as unknown as IncomingMessage;
      expect(getClientIp(req)).toBeNull();
    });
  });

  // ========== Trust mode: "cidrs" ==========
  describe("trust mode = CIDRs", () => {
    beforeEach(() => {
      mockTrustProxy = "10.0.0.0/8,172.16.0.0/12";
      _resetTrustMode();
    });

    it("trusts proxy within CIDR range", () => {
      const req = makeReq({
        remoteAddress: "10.1.2.3",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("trusts proxy in second CIDR range", () => {
      const req = makeReq({
        remoteAddress: "172.16.5.10",
        headers: { "x-forwarded-for": "198.51.100.14" },
      });
      expect(getClientIp(req)).toBe("198.51.100.14");
    });

    it("does not trust proxy outside CIDR range", () => {
      const req = makeReq({
        remoteAddress: "192.168.1.1",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("192.168.1.1");
    });

    it("handles IPv6-mapped IPv4 remoteAddress in CIDR mode", () => {
      const req = makeReq({
        remoteAddress: "::ffff:10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("handles single IP CIDR (no prefix)", () => {
      mockTrustProxy = "192.168.1.1";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "192.168.1.1",
        headers: { "x-forwarded-for": "8.8.8.8" },
      });
      expect(getClientIp(req)).toBe("8.8.8.8");
    });

    it("handles invalid CIDR gracefully (falls back to none)", () => {
      mockTrustProxy = "not-a-cidr,also-invalid";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      // All CIDRs parsed as null, so ranges = [], trustMode = "none"
      expect(getClientIp(req)).toBe("10.0.0.1");
    });
  });

  // ========== IPv6 CIDR matching ==========
  describe("IPv6 CIDR matching", () => {
    beforeEach(() => {
      mockTrustProxy = "fd00::/8";
      _resetTrustMode();
    });

    it("trusts IPv6 proxy within CIDR range", () => {
      const req = makeReq({
        remoteAddress: "fd00::1",
        headers: { "x-forwarded-for": "2001:db8::1" },
      });
      expect(getClientIp(req)).toBe("2001:db8::1");
    });

    it("does not trust IPv6 proxy outside CIDR range", () => {
      const req = makeReq({
        remoteAddress: "2001:db8::1",
        headers: { "x-forwarded-for": "fd00::99" },
      });
      expect(getClientIp(req)).toBe("2001:db8::1");
    });
  });

  // ========== IPv6 parsing edge cases ==========
  describe("IPv6 parsing edge cases", () => {
    beforeEach(() => {
      mockTrustProxy = "::ffff:10.0.0.0/96";
      _resetTrustMode();
    });

    it("handles IPv4-mapped IPv6 CIDR", () => {
      // ::ffff:10.0.0.1 is normalized to "10.0.0.1" which doesn't match IPv6 CIDR
      const req = makeReq({
        remoteAddress: "::ffff:10.0.0.1",
        headers: { "x-forwarded-for": "8.8.8.8" },
      });
      // Normalized to 10.0.0.1 -> doesn't match ::ffff:10.0.0.0/96 (IPv6 CIDR)
      expect(getClientIp(req)).toBe("10.0.0.1");
    });
  });

  // ========== _resetTrustMode ==========
  describe("_resetTrustMode", () => {
    it("clears cached trust mode, allowing re-evaluation", () => {
      mockTrustProxy = "true";
      _resetTrustMode();
      const req1 = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req1)).toBe("1.2.3.4"); // trusted

      mockTrustProxy = "false";
      _resetTrustMode();
      const req2 = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req2)).toBe("10.0.0.1"); // not trusted
    });
  });

  // ========== normalizeIp edge cases ==========
  describe("normalizeIp edge cases", () => {
    it("handles ::ffff: prefix with invalid IPv4 suffix", () => {
      // "::ffff:not.an.ip" — isIP returns 0, so it stays as-is
      mockTrustProxy = "true";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "::ffff:999.999.999.999" },
      });
      // Invalid IP, rejected by isValidIp
      expect(getClientIp(req)).toBe("10.0.0.1");
    });
  });

  // ========== CIDR edge cases ==========
  describe("CIDR parsing edge cases", () => {
    it("handles CIDR with invalid prefix length", () => {
      mockTrustProxy = "10.0.0.0/33";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      // Invalid prefix -> null -> ranges empty -> trust mode "none"
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles IPv6 CIDR with invalid prefix length", () => {
      mockTrustProxy = "fd00::/129";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "fd00::1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("fd00::1");
    });

    it("handles IPv4 with out-of-range octets", () => {
      mockTrustProxy = "256.0.0.0/8";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles IPv6 with too many :: separators", () => {
      mockTrustProxy = "fd00::1::2/64";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "fd00::1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("fd00::1");
    });

    it("handles IPv6 with too many groups", () => {
      mockTrustProxy = "1:2:3:4:5:6:7:8:9/64";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "fd00::1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("fd00::1");
    });

    it("handles empty addr in CIDR", () => {
      mockTrustProxy = "/24";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles CIDR with negative prefix", () => {
      mockTrustProxy = "10.0.0.0/-1";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles IPv4 with wrong number of octets", () => {
      mockTrustProxy = "10.0.0/24";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("handles valid IPv6 full form", () => {
      mockTrustProxy = "2001:0db8:0000:0000:0000:0000:0000:0001/128";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "2001:db8::1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("handles IPv6 with right-side groups after ::", () => {
      mockTrustProxy = "fd00::1:2/128";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "fd00::1:2",
        headers: { "x-forwarded-for": "8.8.4.4" },
      });
      expect(getClientIp(req)).toBe("8.8.4.4");
    });
  });

  // ========== ipInCidr version mismatch ==========
  describe("CIDR version mismatch", () => {
    it("IPv4 address does not match IPv6 CIDR", () => {
      mockTrustProxy = "fd00::/8";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "10.0.0.1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      // IPv4 remoteAddress can't match IPv6 CIDR
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("IPv6 address does not match IPv4 CIDR", () => {
      mockTrustProxy = "10.0.0.0/8";
      _resetTrustMode();
      const req = makeReq({
        remoteAddress: "fd00::1",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIp(req)).toBe("fd00::1");
    });
  });

  // ========== socket without remoteAddress ==========
  describe("missing socket", () => {
    it("returns null when socket is null", () => {
      const req = { socket: null, headers: {} } as unknown as IncomingMessage;
      expect(getClientIp(req)).toBeNull();
    });
  });
});
