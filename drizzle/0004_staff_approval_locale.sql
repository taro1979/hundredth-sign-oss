ALTER TABLE `users`
  ADD COLUMN `locale` varchar(10) NOT NULL DEFAULT 'ja';
--> statement-breakpoint
ALTER TABLE `internalApprovals`
  ADD COLUMN `locale` varchar(10) NOT NULL DEFAULT 'ja';
