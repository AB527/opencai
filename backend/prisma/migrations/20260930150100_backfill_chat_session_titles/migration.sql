-- Backfill titles for sessions created before titles existed, from each
-- session's first user message -- the same source new sessions use (see
-- titleFromMessage in chat.service.js). Only untitled sessions are touched.
UPDATE "chat_sessions" AS s
SET "title" = CASE
    WHEN char_length(first_msg.text) <= 60 THEN first_msg.text
    ELSE rtrim(left(first_msg.text, 59)) || '…'
  END
FROM (
  SELECT DISTINCT ON (m."sessionId")
    m."sessionId",
    btrim(regexp_replace(m."content", '\s+', ' ', 'g')) AS text
  FROM "chat_messages" AS m
  WHERE m."role" = 'USER'
  ORDER BY m."sessionId", m."createdAt" ASC
) AS first_msg
WHERE s."id" = first_msg."sessionId"
  AND s."title" IS NULL
  AND first_msg.text <> '';
