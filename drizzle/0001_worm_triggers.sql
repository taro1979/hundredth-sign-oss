-- WORM Enforcement Triggers
--
-- Adds database-level guards for immutable audit evidence. The application
-- still treats these tables as append-only; these triggers protect direct DB access.

CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
BEFORE UPDATE ON system_audit_logs
FOR EACH ROW
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'WORM violation: UPDATE on system_audit_logs is prohibited';
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
BEFORE DELETE ON system_audit_logs
FOR EACH ROW
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'WORM violation: DELETE on system_audit_logs is prohibited';
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS prevent_worm_record_delete
BEFORE DELETE ON worm_records
FOR EACH ROW
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'WORM violation: DELETE on worm_records is prohibited';
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS prevent_worm_record_tamper
BEFORE UPDATE ON worm_records
FOR EACH ROW
BEGIN
  IF OLD.storageKey != NEW.storageKey
    OR OLD.contentHash != NEW.contentHash
    OR OLD.fileSizeBytes != NEW.fileSizeBytes
    OR OLD.documentId != NEW.documentId
    OR OLD.organizationId != NEW.organizationId
    OR NOT (OLD.actorUserId <=> NEW.actorUserId)
    OR NOT (OLD.encryptionIv <=> NEW.encryptionIv)
    OR NOT (OLD.encryptionTag <=> NEW.encryptionTag)
    OR NOT (OLD.keyVersion <=> NEW.keyVersion)
  THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'WORM violation: immutable fields on worm_records cannot be changed';
  END IF;
END;
