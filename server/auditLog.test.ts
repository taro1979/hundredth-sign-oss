import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

const createChainedQuery = (data: any[] = []) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockImplementation(() => data),
  };
  // For count queries, make limit resolve to data
  chain.limit.mockImplementation(() => {
    return { offset: vi.fn().mockResolvedValue(data) };
  });
  return chain;
};

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../drizzle/schema", () => ({
  systemAuditLogs: {
    id: "id",
    eventType: "eventType",
    entityType: "entityType",
    entityId: "entityId",
    organizationId: "organizationId",
    actorUserId: "actorUserId",
    actorEmail: "actorEmail",
    ipAddress: "ipAddress",
    userAgent: "userAgent",
    metadata: "metadata",
    previousHash: "previousHash",
    recordHash: "recordHash",
    serverTimestamp: "serverTimestamp",
  },
}));

import { getDb } from "./db";
import {
  appendAuditLog,
  appendAuditLogBatch,
  getAuditLogsByEntity,
  getAuditLogsByOrg,
  getAuditLogsByTimeRange,
  getAuditLogCount,
  getAuditLogsPaginated,
  verifyHashChainIntegrity,
  computeRecordHash,
  WORM_POLICY,
} from "./auditLog";

describe("AuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeRecordHash", () => {
    it("should compute a deterministic hash", () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);
      const hash2 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);
      const hash2 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 2,
      }, 1000);
      expect(hash1).not.toBe(hash2);
    });

    it("should chain with previous hash", () => {
      const hash1 = computeRecordHash("previous-hash-value", {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);
      const hash2 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);
      expect(hash1).not.toBe(hash2);
    });

    it("should include metadata in hash computation", () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        metadata: { key: "value1" },
      }, 1000);
      const hash2 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        metadata: { key: "value2" },
      }, 1000);
      expect(hash1).not.toBe(hash2);
    });

    it("should include ipAddress in hash computation", () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        ipAddress: "1.2.3.4",
      }, 1000);
      const hash2 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        ipAddress: "5.6.7.8",
      }, 1000);
      expect(hash1).not.toBe(hash2);
    });

    it("should return a hex string", () => {
      const hash = computeRecordHash(null, {
        eventType: "doc.created" as any,
      }, 1000);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("appendAuditLog", () => {
    it("should insert a record into the database", async () => {
      const mockValues = vi.fn().mockResolvedValue([{ insertId: 1 }]);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await appendAuditLog({
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
        actorUserId: 10,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
        eventType: "doc.created",
        entityType: "document",
        entityId: 1,
        actorUserId: 10,
      }));
      expect(result).toEqual({ id: 1, recordHash: expect.any(String) });
    });

    it("should throw when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);

      await expect(appendAuditLog({
        eventType: "doc.created" as any,
      })).rejects.toThrow("Database not available for audit log");
    });

    it("should include optional fields when provided", async () => {
      const mockValues = vi.fn().mockResolvedValue([{ insertId: 2 }]);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      await appendAuditLog({
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
        organizationId: 5,
        actorUserId: 10,
        actorEmail: "test@example.com",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { action: "test" },
      });

      // When PII_ENCRYPTION_KEY is not set (test env), encryptPii returns plaintext.
      // When set, it would return enc:v1:... format.
      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
        actorEmail: expect.any(String),
        ipAddress: expect.any(String),
        userAgent: "Mozilla/5.0",
        organizationId: 5,
      }));
    });

    it("chains with previous record hash in fallback path (non-null previousHash branch)", async () => {
      const mockValues = vi.fn().mockResolvedValue([{ insertId: 5 }]);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ recordHash: "existing-hash-abc" }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await appendAuditLog({ eventType: "doc.signed" as any });
      expect(result.id).toBe(5);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ previousHash: "existing-hash-abc" })
      );
    });
  });

  describe("appendAuditLogBatch", () => {
    it("should insert multiple records", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      await appendAuditLogBatch([
        { eventType: "doc.created" as any, entityId: 1 },
        { eventType: "doc.signed" as any, entityId: 2 },
      ]);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ eventType: "doc.created" }),
        expect.objectContaining({ eventType: "doc.signed" }),
      ]));
    });

    it("should skip empty batch", async () => {
      await appendAuditLogBatch([]);
      expect(getDb).not.toHaveBeenCalled();
    });

    it("should chain hashes across batch entries", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      await appendAuditLogBatch([
        { eventType: "doc.created" as any },
        { eventType: "doc.signed" as any },
      ]);

      const insertedRows = mockValues.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      // Second row's previousHash should be first row's recordHash
      expect(insertedRows[1].previousHash).toBe(insertedRows[0].recordHash);
    });

    it("should throw when database is not available", async () => {
      (getDb as any).mockResolvedValue(null);

      await expect(appendAuditLogBatch([
        { eventType: "doc.created" as any },
      ])).rejects.toThrow("Database not available for audit log");
    });

    it("chains from previous record hash in batch fallback path (non-null previousHash branch)", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ recordHash: "batch-prev-hash" }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: mockValues }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      await appendAuditLogBatch([{ eventType: "doc.created" as any }]);
      expect(mockValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ previousHash: "batch-prev-hash" }),
        ])
      );
    });
  });

  describe("getAuditLogsByEntity", () => {
    it("should query by entity type, id, and organizationId", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: mockWhere,
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogsByEntity("document", 1, 100);
      expect(result).toEqual([{ id: 1 }]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await getAuditLogsByEntity("document", 1, 100);
      expect(result).toEqual([]);
    });

    it("should use custom limit", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      await getAuditLogsByEntity("document", 1, 200, 50);
      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });

  describe("getAuditLogsByOrg", () => {
    it("should query by organization id", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogsByOrg(1);
      expect(result).toEqual([{ id: 1 }]);
    });

    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await getAuditLogsByOrg(1);
      expect(result).toEqual([]);
    });
  });

  describe("getAuditLogsByTimeRange", () => {
    it("should query by time range", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogsByTimeRange(1000, 2000);
      expect(result).toEqual([{ id: 1 }]);
    });

    it("should return empty array when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await getAuditLogsByTimeRange(1000, 2000);
      expect(result).toEqual([]);
    });
  });

  describe("getAuditLogCount", () => {
    it("should return count for organization", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 42 }]),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogCount(1);
      expect(result).toBe(42);
    });

    it("should return 0 without organization filter (security: org required)", async () => {
      // SECURITY: organizationId is required for data isolation
      const result = await getAuditLogCount();
      expect(result).toBe(0);
    });

    it("should return 0 when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await getAuditLogCount();
      expect(result).toBe(0);
    });

    it("should return 0 when result is empty", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogCount();
      expect(result).toBe(0);
    });

    it("returns 0 when count query returns empty array with organizationId (null coalescing path)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // Empty array → result undefined → ?? 0
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await getAuditLogCount(1);
      expect(result).toBe(0);
    });
  });

  describe("getAuditLogsPaginated", () => {
    it("should return paginated results with all filters", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              // First call is for count, second for data
              return [{ count: 10 }];
            }),
            orderBy: vi.fn(),
            limit: vi.fn(),
            offset: vi.fn(),
          }),
        }),
      };
      // Create a more realistic mock
      const mockCountResult = [{ count: 10 }];
      const mockLogs = [{ id: 1 }, { id: 2 }];
      const selectFn = vi.fn();
      const fromFn = vi.fn();
      const whereFn = vi.fn();
      const orderByFn = vi.fn();
      const limitFn = vi.fn();
      const offsetFn = vi.fn();

      selectFn.mockReturnValue({ from: fromFn });
      fromFn.mockReturnValue({ where: whereFn });
      // First where call returns count, second returns data chain
      let callCount = 0;
      whereFn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockCountResult;
        return { orderBy: orderByFn };
      });
      orderByFn.mockReturnValue({ limit: limitFn });
      limitFn.mockReturnValue({ offset: offsetFn });
      offsetFn.mockResolvedValue(mockLogs);

      (getDb as any).mockResolvedValue({ select: selectFn });

      const result = await getAuditLogsPaginated({
        organizationId: 1,
        eventType: "doc.created",
        entityType: "document",
        actorUserId: 10,
        startMs: 1000,
        endMs: 2000,
        page: 2,
        pageSize: 25,
      });

      expect(result.total).toBe(10);
      expect(result.logs).toEqual(mockLogs);
    });

    it("should return empty when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await getAuditLogsPaginated({ organizationId: 1 });
      expect(result).toEqual({ logs: [], total: 0 });
    });

    it("should return empty when organizationId is not provided (security)", async () => {
      const result = await getAuditLogsPaginated({});
      expect(result).toEqual({ logs: [], total: 0 });
    });

    it("should cap pageSize at 200", async () => {
      const selectFn = vi.fn();
      const fromFn = vi.fn();
      const whereFn = vi.fn();
      const orderByFn = vi.fn();
      const limitFn = vi.fn();
      const offsetFn = vi.fn();

      selectFn.mockReturnValue({ from: fromFn });
      fromFn.mockReturnValue({ where: whereFn });
      let callCount = 0;
      whereFn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [{ count: 0 }];
        return { orderBy: orderByFn };
      });
      orderByFn.mockReturnValue({ limit: limitFn });
      limitFn.mockReturnValue({ offset: offsetFn });
      offsetFn.mockResolvedValue([]);

      (getDb as any).mockResolvedValue({ select: selectFn });

      await getAuditLogsPaginated({ organizationId: 1, pageSize: 500 });
      expect(limitFn).toHaveBeenCalledWith(200);
    });

    it("should default to page 1 and pageSize 50", async () => {
      const selectFn = vi.fn();
      const fromFn = vi.fn();
      const whereFn = vi.fn();
      const orderByFn = vi.fn();
      const limitFn = vi.fn();
      const offsetFn = vi.fn();

      selectFn.mockReturnValue({ from: fromFn });
      fromFn.mockReturnValue({ where: whereFn });
      let callCount = 0;
      whereFn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [{ count: 0 }];
        return { orderBy: orderByFn };
      });
      orderByFn.mockReturnValue({ limit: limitFn });
      limitFn.mockReturnValue({ offset: offsetFn });
      offsetFn.mockResolvedValue([]);

      (getDb as any).mockResolvedValue({ select: selectFn });

      await getAuditLogsPaginated({ organizationId: 1 });
      expect(limitFn).toHaveBeenCalledWith(50);
      expect(offsetFn).toHaveBeenCalledWith(0);
    });

    it("returns 0 total when count query returns empty array (null coalescing path)", async () => {
      const selectFn = vi.fn();
      const fromFn = vi.fn();
      const whereFn = vi.fn();
      const orderByFn = vi.fn();
      const limitFn = vi.fn();
      const offsetFn = vi.fn();

      selectFn.mockReturnValue({ from: fromFn });
      fromFn.mockReturnValue({ where: whereFn });
      let callCount = 0;
      whereFn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return []; // Empty → countResult undefined → ?? 0
        return { orderBy: orderByFn };
      });
      orderByFn.mockReturnValue({ limit: limitFn });
      limitFn.mockReturnValue({ offset: offsetFn });
      offsetFn.mockResolvedValue([]);

      (getDb as any).mockResolvedValue({ select: selectFn });

      const result = await getAuditLogsPaginated({ organizationId: 1 });
      expect(result.total).toBe(0);
      expect(result.logs).toEqual([]);
    });
  });

  describe("verifyHashChainIntegrity", () => {
    it("should return intact for empty database", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity();
      expect(result.isIntact).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.brokenAt).toBeNull();
    });

    it("should return intact when db is null", async () => {
      (getDb as any).mockResolvedValue(null);
      const result = await verifyHashChainIntegrity();
      expect(result).toEqual({
        totalRecords: 0,
        verifiedRecords: 0,
        unverifiableRecords: 0,
        brokenAt: null,
        isIntact: true,
      });
    });

    it("should detect broken previousHash chain", async () => {
      // First record has valid hash, second has wrong previousHash
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);

      const records = [
        {
          id: 1,
          eventType: "doc.created",
          entityType: "document",
          entityId: 1,
          actorUserId: null,
          ipAddress: null,
          metadata: null,
          previousHash: null,
          recordHash: hash1,
          serverTimestamp: 1000,
        },
        {
          id: 2,
          eventType: "doc.signed",
          entityType: "document",
          entityId: 1,
          actorUserId: null,
          ipAddress: null,
          metadata: null,
          previousHash: "wrong-previous-hash", // Should be hash1
          recordHash: "some-hash",
          serverTimestamp: 2000,
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(records)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity();
      expect(result.isIntact).toBe(false);
      expect(result.brokenAt).toBe(2);
    });

    it("should detect tampered recordHash", async () => {
      // Create a valid first record
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);

      const records = [
        {
          id: 1,
          eventType: "doc.created",
          entityType: "document",
          entityId: 1,
          actorUserId: null,
          ipAddress: null,
          metadata: null,
          previousHash: null,
          recordHash: "tampered-hash", // Should be hash1
          serverTimestamp: 1000,
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(records)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity();
      expect(result.isIntact).toBe(false);
      expect(result.brokenAt).toBe(1);
    });

    it("should verify intact chain with valid records", async () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
      }, 1000);

      const hash2 = computeRecordHash(hash1, {
        eventType: "doc.signed" as any,
        entityType: "document",
        entityId: 1,
      }, 2000);

      const records = [
        {
          id: 1,
          eventType: "doc.created",
          entityType: "document",
          entityId: 1,
          actorUserId: null,
          ipAddress: null,
          metadata: null,
          previousHash: null,
          recordHash: hash1,
          serverTimestamp: 1000,
        },
        {
          id: 2,
          eventType: "doc.signed",
          entityType: "document",
          entityId: 1,
          actorUserId: null,
          ipAddress: null,
          metadata: null,
          previousHash: hash1,
          recordHash: hash2,
          serverTimestamp: 2000,
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(records)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity();
      expect(result.isIntact).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.verifiedRecords).toBe(2);
    });

    it("should process multiple batches", async () => {
      const hash1 = computeRecordHash(null, {
        eventType: "doc.created" as any,
      }, 1000);

      const batch1 = [{
        id: 1,
        eventType: "doc.created",
        entityType: null,
        entityId: null,
        actorUserId: null,
        ipAddress: null,
        metadata: null,
        previousHash: null,
        recordHash: hash1,
        serverTimestamp: 1000,
      }];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(batch1)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity(undefined, 1); // batch size 1
      expect(result.isIntact).toBe(true);
      expect(result.totalRecords).toBe(1);
    });
  });

  describe("verifyHashChainIntegrity (org-scoped)", () => {
    it("should verify organization-scoped records (hash integrity only, no chain linkage)", async () => {
      const entry = {
        eventType: "doc.created" as any,
        entityType: "document" as any,
        entityId: 1,
        actorUserId: 5,
        ipAddress: "10.0.0.1",
        metadata: { key: "value" },
      };
      const prevHash = "some-previous-hash";
      const ts = 1700000000000;
      const hash = computeRecordHash(prevHash, entry, ts);

      const records = [{
        id: 10,
        eventType: "doc.created",
        entityType: "document",
        entityId: 1,
        actorUserId: 5,
        ipAddress: "10.0.0.1",
        metadata: { key: "value" },
        previousHash: prevHash,
        recordHash: hash,
        serverTimestamp: ts,
        organizationId: 100,
      }];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(records)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity(100);
      expect(result.isIntact).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.verifiedRecords).toBe(1);
    });

    it("should detect tampered record in org-scoped verification", async () => {
      const records = [{
        id: 10,
        eventType: "doc.created",
        entityType: "document",
        entityId: 1,
        actorUserId: null,
        ipAddress: null,
        metadata: null,
        previousHash: "prev",
        recordHash: "tampered-hash",
        serverTimestamp: 1700000000000,
        organizationId: 100,
      }];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn()
                    .mockResolvedValueOnce(records)
                    .mockResolvedValueOnce([]),
                }),
              }),
            }),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await verifyHashChainIntegrity(100);
      expect(result.isIntact).toBe(false);
      expect(result.brokenAt).toBe(10);
    });
  });

  describe("appendAuditLog (transactional path)", () => {
    it("uses transactional path when pool.$client is available", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[{ recordHash: "prev-hash" }]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([{ insertId: 42 }]); // INSERT
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      const result = await appendAuditLog({
        eventType: "doc.created" as any,
        entityType: "document",
        entityId: 1,
        organizationId: 100,
        actorUserId: 5,
        actorEmail: "test@example.com",
        ipAddress: "1.2.3.4",
        userAgent: "Test",
        metadata: { foo: "bar" },
      });
      expect(result.id).toBe(42);
      expect(result.recordHash).toMatch(/^[a-f0-9]{64}$/);
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("rolls back and releases on error", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error("INSERT failed"));
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      await expect(appendAuditLog({ eventType: "doc.created" as any }))
        .rejects.toThrow("INSERT failed");
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("handles empty rows from SELECT FOR UPDATE (genesis)", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]]) // No previous records
        .mockResolvedValueOnce([{ insertId: 1 }]);
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      const result = await appendAuditLog({ eventType: "doc.created" as any });
      expect(result.id).toBe(1);
    });

    it("skips rollback/release when getConnection itself throws (conn is undefined)", async () => {
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockRejectedValue(new Error("No connections available")) },
      });

      await expect(appendAuditLog({ eventType: "doc.created" as any }))
        .rejects.toThrow("No connections available");
      // conn stays undefined → if(conn) is false → no rollback/release called
    });

    it("handles rollback failure gracefully when INSERT fails (inner catch branch)", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error("INSERT failed"));
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn().mockRejectedValue(new Error("Rollback also failed")), // rollback throws
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      // The outer error should propagate even though rollback also fails
      await expect(appendAuditLog({ eventType: "doc.created" as any }))
        .rejects.toThrow("INSERT failed");
      // rollback was called and threw, but inner catch handled it silently
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("chains previousHash from non-empty SELECT FOR UPDATE result", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[{ recordHash: "existing-record-hash" }]]) // SELECT returns row
        .mockResolvedValueOnce([{ insertId: 77 }]);
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      const result = await appendAuditLog({ eventType: "doc.signed" as any });
      expect(result.id).toBe(77);
      // Verify the INSERT was called with the previousHash from SELECT
      const insertCall = mockExecute.mock.calls[1];
      expect(insertCall[1]).toContain("existing-record-hash");
    });
  });

  describe("appendAuditLogBatch (transactional path)", () => {
    it("inserts batch via transactional path when pool is available", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]]) // SELECT FOR UPDATE
        .mockResolvedValue([{ insertId: 1 }]); // INSERTs
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      await appendAuditLogBatch([
        { eventType: "doc.created" as any, entityId: 1, metadata: { a: 1 } },
        { eventType: "doc.signed" as any, entityId: 1 },
      ]);
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      // SELECT + 2 INSERTs
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it("rolls back batch on transactional error", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([{ insertId: 1 }]) // First INSERT ok
        .mockRejectedValueOnce(new Error("Second INSERT failed"));
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      await expect(appendAuditLogBatch([
        { eventType: "doc.created" as any },
        { eventType: "doc.signed" as any },
      ])).rejects.toThrow("Second INSERT failed");
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("skips rollback/release when batch getConnection itself throws (conn is undefined)", async () => {
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockRejectedValue(new Error("Batch pool exhausted")) },
      });

      await expect(appendAuditLogBatch([{ eventType: "doc.created" as any }]))
        .rejects.toThrow("Batch pool exhausted");
      // conn stays undefined → if(conn) is false in catch/finally
    });

    it("handles rollback failure gracefully when batch INSERT fails (inner catch branch)", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]]) // SELECT FOR UPDATE
        .mockRejectedValueOnce(new Error("Batch INSERT failed"));
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn().mockRejectedValue(new Error("Batch rollback also failed")), // rollback throws
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      // The outer error should propagate even though rollback also fails
      await expect(appendAuditLogBatch([{ eventType: "doc.created" as any }]))
        .rejects.toThrow("Batch INSERT failed");
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it("chains from non-empty SELECT FOR UPDATE result in batch (non-null previousHash)", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[{ recordHash: "batch-existing-hash" }]]) // SELECT returns row
        .mockResolvedValue([{ insertId: 1 }]);
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      (getDb as any).mockResolvedValue({
        $client: { getConnection: vi.fn().mockResolvedValue(mockConn) },
      });

      await appendAuditLogBatch([{ eventType: "doc.created" as any }]);
      expect(mockConn.commit).toHaveBeenCalled();
      // Verify INSERT was called with the previousHash from SELECT
      const insertCall = mockExecute.mock.calls[1];
      expect(insertCall[1]).toContain("batch-existing-hash");
    });
  });

  describe("appendAuditLog (pool.promise() branch)", () => {
    it("uses promise() wrapper when $client.promise is a function", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 99 }]);
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      const innerPool = { getConnection: vi.fn().mockResolvedValue(mockConn) };
      (getDb as any).mockResolvedValue({
        $client: { promise: vi.fn(() => innerPool) },
      });

      const result = await appendAuditLog({ eventType: "doc.created" as any });
      expect(result.id).toBe(99);
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
    });
  });

  describe("appendAuditLogBatch (pool.promise() branch)", () => {
    it("uses promise() wrapper for batch when $client.promise is a function", async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce([[]]) // SELECT FOR UPDATE
        .mockResolvedValue([{ insertId: 1 }]); // INSERTs
      const mockConn = {
        beginTransaction: vi.fn(),
        execute: mockExecute,
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
      };
      const innerPool = { getConnection: vi.fn().mockResolvedValue(mockConn) };
      (getDb as any).mockResolvedValue({
        $client: { promise: vi.fn(() => innerPool) },
      });

      await appendAuditLogBatch([
        { eventType: "doc.created" as any },
        { eventType: "doc.signed" as any },
      ]);
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledTimes(3); // SELECT + 2 INSERTs
    });
  });

  describe("getAuditLogsPaginated (organizationId guard with db available)", () => {
    it("returns empty when db is available but organizationId is not provided", async () => {
      // Provide a non-null db so the early-return guard is NOT triggered,
      // and the organizationId check at line 454 is reached
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      });
      const result = await getAuditLogsPaginated({});
      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe("stableJsonStringify edge cases", () => {
    it("should handle null metadata in hash", () => {
      const hash = computeRecordHash(null, {
        eventType: "doc.created" as any,
        metadata: undefined,
      }, 1000);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle metadata with nested arrays and objects", () => {
      const hash = computeRecordHash(null, {
        eventType: "doc.created" as any,
        metadata: { arr: [1, { b: 2, a: 1 }, [3]], str: "test", num: 42, nil: null },
      }, 1000);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("WORM_POLICY", () => {
    it("should be frozen", () => {
      expect(Object.isFrozen(WORM_POLICY)).toBe(true);
    });

    it("should only allow INSERT and SELECT", () => {
      expect(WORM_POLICY.allowedOperations).toEqual(["INSERT", "SELECT"]);
    });

    it("should prohibit UPDATE, DELETE, TRUNCATE, DROP", () => {
      expect(WORM_POLICY.prohibitedOperations).toContain("UPDATE");
      expect(WORM_POLICY.prohibitedOperations).toContain("DELETE");
      expect(WORM_POLICY.prohibitedOperations).toContain("TRUNCATE");
      expect(WORM_POLICY.prohibitedOperations).toContain("DROP");
    });
  });
});
