-- Add scheduledDate field to Job model for scheduling adhoc jobs
ALTER TABLE "Job" ADD COLUMN "scheduledDate" TEXT NOT NULL DEFAULT '';
