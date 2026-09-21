-- AdminMessage.to also carries the broadcast sentinel 'all' (see getMessagesForDriver
-- and /api/notifications/send), which is not a real Driver.name row and always
-- violated this FK — every "message all drivers" send failed to save.
ALTER TABLE "AdminMessage" DROP CONSTRAINT "AdminMessage_to_fkey";
