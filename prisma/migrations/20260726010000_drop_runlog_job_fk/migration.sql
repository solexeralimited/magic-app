-- Run history must survive the deletion of the job rows it describes:
-- promote-to-daily deletes yesterday's Daily jobs, which the RESTRICT
-- constraint would block as soon as any job had a history entry.
ALTER TABLE "RunLog" DROP CONSTRAINT "RunLog_jobId_fkey";
