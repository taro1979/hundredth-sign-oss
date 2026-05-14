CREATE TABLE `integration_idempotency_keys` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `apiKeyId` int NOT NULL,
  `idempotencyKey` varchar(255) NOT NULL,
  `requestMethod` varchar(16) NOT NULL,
  `requestPath` varchar(512) NOT NULL,
  `requestHash` varchar(64) NOT NULL,
  `responseStatus` int NOT NULL,
  `responseBody` json NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `integration_idempotency_keys_id` PRIMARY KEY(`id`),
  CONSTRAINT `uniq_integration_idempotency_key` UNIQUE(`organizationId`,`apiKeyId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `idx_integration_idempotency_expires` ON `integration_idempotency_keys` (`expiresAt`);
