ALTER TABLE `documents`
  ADD COLUMN `externalSystem` varchar(100),
  ADD COLUMN `externalEntityType` varchar(100),
  ADD COLUMN `externalEntityId` varchar(255),
  ADD COLUMN `externalMetadata` json;
--> statement-breakpoint

CREATE INDEX `idx_documents_external_ref`
  ON `documents` (`externalSystem`, `externalEntityType`, `externalEntityId`);
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_documents_external_ref_unique`
  ON `documents` (`organizationId`, `externalSystem`, `externalEntityType`, `externalEntityId`);
--> statement-breakpoint

CREATE TABLE `integration_api_keys` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `createdByUserId` int,
  `name` varchar(255) NOT NULL,
  `keyPrefix` varchar(32) NOT NULL,
  `keyHash` varchar(64) NOT NULL,
  `scopes` json NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `lastUsedAt` timestamp,
  `revokedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `integration_api_keys_id` PRIMARY KEY(`id`),
  CONSTRAINT `integration_api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint

CREATE INDEX `idx_integration_api_keys_org`
  ON `integration_api_keys` (`organizationId`);
--> statement-breakpoint

CREATE INDEX `idx_integration_api_keys_prefix`
  ON `integration_api_keys` (`keyPrefix`);
--> statement-breakpoint

CREATE TABLE `integration_webhooks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `targetUrl` text NOT NULL,
  `secretHash` varchar(64) NOT NULL,
  `events` json NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdByApiKeyId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `integration_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE INDEX `idx_integration_webhooks_org`
  ON `integration_webhooks` (`organizationId`);
--> statement-breakpoint

CREATE TABLE `integration_webhook_deliveries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `webhookId` int NOT NULL,
  `organizationId` int NOT NULL,
  `eventType` varchar(100) NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  `attemptCount` int NOT NULL DEFAULT 0,
  `lastStatusCode` int,
  `lastError` text,
  `nextAttemptAt` timestamp,
  `deliveredAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `integration_webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE INDEX `idx_integration_webhook_deliveries_webhook`
  ON `integration_webhook_deliveries` (`webhookId`);
--> statement-breakpoint

CREATE INDEX `idx_integration_webhook_deliveries_status`
  ON `integration_webhook_deliveries` (`status`, `nextAttemptAt`);
