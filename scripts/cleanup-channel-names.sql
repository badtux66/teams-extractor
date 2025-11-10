-- Teams Message Extractor - Channel Name Cleanup Script
-- This script fixes channel_name values that contain message content instead of actual channel names
-- Run this script to clean up data extracted before the content.js fix (v1.0.2)

BEGIN;

-- Show summary of current state
SELECT 'Current state:' as info;
SELECT
  COUNT(*) as total_messages,
  COUNT(CASE WHEN channel_name ~ '^\d{1,2}\s+\w+\s+\w+$' THEN 1 END) as date_like_names,
  COUNT(CASE WHEN channel_name LIKE '%kullanıcısından%' THEN 1 END) as message_like_names,
  COUNT(CASE WHEN LENGTH(channel_name) > 100 THEN 1 END) as too_long_names,
  COUNT(CASE WHEN channel_name = 'Unknown' THEN 1 END) as unknown_names
FROM teams.messages;

-- Create a backup table (optional, comment out if not needed)
-- CREATE TABLE teams.messages_backup AS SELECT * FROM teams.messages;

-- Update messages with date-like channel names (e.g., "23 Temmuz Çarşamba")
UPDATE teams.messages
SET
  channel_name = 'Unknown',
  updated_at = NOW()
WHERE channel_name ~ '^\d{1,2}\s+\w+\s+\w+$';

-- Update messages with message content in channel_name (containing "kullanıcısından")
UPDATE teams.messages
SET
  channel_name = 'Unknown',
  updated_at = NOW()
WHERE channel_name LIKE '%kullanıcısından%';

-- Update messages with overly long channel names (likely message content)
UPDATE teams.messages
SET
  channel_name = 'Unknown',
  updated_at = NOW()
WHERE LENGTH(channel_name) > 100;

-- Show summary of changes
SELECT 'After cleanup:' as info;
SELECT
  COUNT(*) as total_messages,
  COUNT(CASE WHEN channel_name ~ '^\d{1,2}\s+\w+\s+\w+$' THEN 1 END) as date_like_names,
  COUNT(CASE WHEN channel_name LIKE '%kullanıcısından%' THEN 1 END) as message_like_names,
  COUNT(CASE WHEN LENGTH(channel_name) > 100 THEN 1 END) as too_long_names,
  COUNT(CASE WHEN channel_name = 'Unknown' THEN 1 END) as unknown_names
FROM teams.messages;

-- Review a sample of updated records
SELECT
  message_id,
  channel_name,
  LEFT(content, 50) as content_preview,
  sender_name,
  timestamp
FROM teams.messages
WHERE channel_name = 'Unknown'
LIMIT 10;

-- If everything looks good, commit the changes
-- If not, rollback with: ROLLBACK;
COMMIT;

-- Note: After running this script, reload the Chrome extension (v1.0.2) to ensure
-- new messages are extracted with correct channel names.
