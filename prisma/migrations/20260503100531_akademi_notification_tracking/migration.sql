-- Akademi notification idempotency columns

ALTER TABLE "user_course_assignments"
  ADD COLUMN "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN "missedNotifiedAt" TIMESTAMP(3);

ALTER TABLE "akademi_certificates"
  ADD COLUMN "expiringSoonNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "expiredNotifiedAt" TIMESTAMP(3);
