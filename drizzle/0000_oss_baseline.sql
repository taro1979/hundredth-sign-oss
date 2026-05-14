CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`details` text,
	`ipAddress` varchar(512),
	`userAgent` text,
	`actorEmail` varchar(512),
	`organizationId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `allowed_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`label` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `allowed_ips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`groupId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_group_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cgm_contact_group` UNIQUE(`contactId`,`groupId`)
);
--> statement-breakpoint
CREATE TABLE `contact_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(255),
	`department` varchar(255),
	`phone` varchar(50),
	`notes` text,
	`category` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`fileUrl` text,
	`fileKey` text,
	`fileName` varchar(500),
	`fileSize` int,
	`mimeType` varchar(100),
	`pageCount` int DEFAULT 0,
	`status` enum('draft','pending_internal_approval','sent','completed','declined','voided','expired') NOT NULL DEFAULT 'draft',
	`sequentialRouting` boolean NOT NULL DEFAULT false,
	`sourceTemplateId` int,
	`expirationDays` int,
	`reminderDays` int,
	`nextReminderAt` timestamp,
	`expiresAt` timestamp,
	`completedAt` timestamp,
	`signedFileUrl` text,
	`signedFileKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`toName` varchar(255),
	`subject` varchar(500) NOT NULL,
	`type` enum('signature_request','signature_complete','signature_declined','all_signed','document_voided','reminder','password_reset','staff_invitation') NOT NULL,
	`documentId` int,
	`signatureRequestId` int,
	`emailStatus` enum('sent','failed') NOT NULL DEFAULT 'sent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category` varchar(100),
	`order` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(255),
	`phone` varchar(50),
	`subject` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','read','replied','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internalApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`approverEmail` varchar(320) NOT NULL,
	`approverName` varchar(255),
	`approverUserId` int,
	`approvalOrder` int NOT NULL DEFAULT 1,
	`approvalStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvalComment` text,
	`approvalAccessToken` varchar(128),
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internalApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`memberRole` enum('owner','manager','member') NOT NULL DEFAULT 'member',
	`isActive` boolean NOT NULL DEFAULT true,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_memberships_user_org` UNIQUE(`userId`,`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`ownerUserId` int NOT NULL,
	`domain` varchar(255),
	`logoUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `signatureFields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`page` int NOT NULL,
	`xPercent` float NOT NULL,
	`yPercent` float NOT NULL,
	`widthPercent` float NOT NULL,
	`heightPercent` float NOT NULL,
	`signerIndex` int NOT NULL,
	`fieldType` enum('signature','date','name','initials','stamp') NOT NULL DEFAULT 'signature',
	`label` varchar(255),
	`required` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signatureFields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signatureRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`signerEmail` varchar(320) NOT NULL,
	`signerName` varchar(255),
	`signerUserId` int,
	`recipientRole` enum('signer','cc','approver') NOT NULL DEFAULT 'signer',
	`order` int NOT NULL DEFAULT 1,
	`status` enum('pending','sent','viewed','signed','declined','expired') NOT NULL DEFAULT 'pending',
	`accessToken` varchar(128),
	`accessCode` varchar(255),
	`signatureDataUrl` text,
	`signatureFont` varchar(100),
	`stampDataUrl` text,
	`signedAt` timestamp,
	`declinedAt` timestamp,
	`declineReason` text,
	`message` text,
	`signerIpAddress` varchar(45),
	`signerUserAgent` text,
	`delegatedToEmail` varchar(320),
	`delegatedToName` varchar(255),
	`delegatedAt` timestamp,
	`locale` varchar(10) NOT NULL DEFAULT 'ja',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signatureRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `signatureRequests_accessToken_unique` UNIQUE(`accessToken`)
);
--> statement-breakpoint
CREATE TABLE `system_audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`organizationId` int,
	`actorUserId` int,
	`actorEmail` varchar(512),
	`ipAddress` varchar(512),
	`userAgent` text,
	`metadata` json,
	`previousHash` varchar(64),
	`recordHash` varchar(64) NOT NULL,
	`serverTimestamp` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templateFields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`page` int NOT NULL,
	`xPercent` float NOT NULL,
	`yPercent` float NOT NULL,
	`widthPercent` float NOT NULL,
	`heightPercent` float NOT NULL,
	`signerIndex` int NOT NULL,
	`templateFieldType` enum('signature','date','name','initials','stamp') NOT NULL DEFAULT 'signature',
	`label` varchar(255),
	`required` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `templateFields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`category` varchar(100),
	`fileUrl` text,
	`fileKey` text,
	`fileName` varchar(500),
	`pageCount` int DEFAULT 0,
	`signerCount` int DEFAULT 1,
	`defaultExpirationDays` int,
	`defaultReminderDays` int,
	`isPublic` boolean NOT NULL DEFAULT false,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255),
	`staffRole` enum('admin','member') NOT NULL DEFAULT 'member',
	`isActive` boolean NOT NULL DEFAULT true,
	`mustChangePassword` boolean NOT NULL DEFAULT false,
	`loginMethod` varchar(64),
	`isSuperAdmin` boolean NOT NULL DEFAULT false,
	`avatarUrl` text,
	`phone` varchar(50),
	`signatureFont` varchar(100) DEFAULT 'dancing-script',
	`signatureText` varchar(255),
	`sealLastName` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `worm_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`fileSizeBytes` int NOT NULL,
	`documentId` int NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int,
	`url` text NOT NULL,
	`encryptionIv` varchar(24),
	`encryptionTag` varchar(24),
	`keyVersion` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `worm_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `worm_records_storageKey_unique` UNIQUE(`storageKey`)
);
