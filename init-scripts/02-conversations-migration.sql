-- Migration: Add conversation support and deduplication features
-- This migration adds:
-- 1. Conversations table for organizing messages
-- 2. Message hash for deduplication
-- 3. Extraction checkpoints for incremental extraction
-- 4. Additional tracking fields

-- ============================================
-- 1. CREATE CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS teams.conversations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('channel', 'chat', 'meeting', 'direct')),
    team_id VARCHAR(255),
    team_name VARCHAR(500),
    description TEXT,
    participants JSONB DEFAULT '[]'::jsonb,
    last_activity TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversations
CREATE INDEX idx_conversations_type ON teams.conversations(type);
CREATE INDEX idx_conversations_team_id ON teams.conversations(team_id);
CREATE INDEX idx_conversations_last_activity ON teams.conversations(last_activity DESC);
CREATE INDEX idx_conversations_name_trgm ON teams.conversations USING gin(name gin_trgm_ops);

-- ============================================
-- 2. ADD DEDUPLICATION FIELDS TO MESSAGES
-- ============================================

-- Add conversation reference
ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255) REFERENCES teams.conversations(id) ON DELETE SET NULL;

-- Add deduplication hash
ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS message_hash VARCHAR(64) UNIQUE;

-- Add extraction tracking
ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS first_extracted_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS extraction_count INTEGER DEFAULT 1;

-- Add parent message reference for threaded replies
ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS parent_message_id VARCHAR(255);

-- Add reply count for threads
ALTER TABLE teams.messages
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_messages_message_hash ON teams.messages(message_hash) WHERE message_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON teams.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON teams.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

-- ============================================
-- 3. CREATE EXTRACTION CHECKPOINTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS teams.extraction_checkpoints (
    conversation_id VARCHAR(255) PRIMARY KEY REFERENCES teams.conversations(id) ON DELETE CASCADE,
    last_message_id VARCHAR(255),
    last_message_timestamp TIMESTAMPTZ,
    last_extraction_timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_extracted INTEGER DEFAULT 0,
    messages_since_last INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for checkpoint queries
CREATE INDEX idx_checkpoints_last_extraction ON teams.extraction_checkpoints(last_extraction_timestamp DESC);
CREATE INDEX idx_checkpoints_status ON teams.extraction_checkpoints(status);

-- ============================================
-- 4. CREATE MESSAGE THREADS VIEW
-- ============================================

-- View to easily query threaded messages
CREATE OR REPLACE VIEW teams.message_threads AS
SELECT
    m.id,
    m.message_id,
    m.conversation_id,
    m.content,
    m.sender_name,
    m.timestamp,
    m.parent_message_id,
    m.reply_count,
    m.thread_id,
    COALESCE(m.parent_message_id, m.message_id) as root_message_id,
    CASE
        WHEN m.parent_message_id IS NULL THEN 0
        ELSE 1
    END as thread_depth
FROM teams.messages m;

-- ============================================
-- 5. UPDATE TRIGGERS AND FUNCTIONS
-- ============================================

-- Trigger to update conversation last_activity when message is added
CREATE OR REPLACE FUNCTION teams.update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.conversation_id IS NOT NULL THEN
        UPDATE teams.conversations
        SET
            last_activity = NEW.timestamp,
            message_count = message_count + 1,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation
    AFTER INSERT ON teams.messages
    FOR EACH ROW
    EXECUTE FUNCTION teams.update_conversation_activity();

-- Trigger to update parent message reply_count
CREATE OR REPLACE FUNCTION teams.update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_message_id IS NOT NULL THEN
        UPDATE teams.messages
        SET reply_count = reply_count + 1
        WHERE message_id = NEW.parent_message_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_reply_count
    AFTER INSERT ON teams.messages
    FOR EACH ROW
    EXECUTE FUNCTION teams.update_reply_count();

-- Trigger for conversations updated_at
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON teams.conversations
    FOR EACH ROW
    EXECUTE FUNCTION teams.update_updated_at();

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to generate message hash
CREATE OR REPLACE FUNCTION teams.generate_message_hash(
    p_channel_id VARCHAR,
    p_sender_id VARCHAR,
    p_timestamp TIMESTAMPTZ,
    p_content TEXT
) RETURNS VARCHAR AS $$
DECLARE
    hash_input TEXT;
BEGIN
    -- Create deterministic string from message components
    hash_input := COALESCE(p_channel_id, '') || '|' ||
                  COALESCE(p_sender_id, '') || '|' ||
                  COALESCE(p_timestamp::TEXT, '') || '|' ||
                  COALESCE(p_content, '');

    -- Return SHA-256 hash
    RETURN encode(digest(hash_input, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to backfill message hashes for existing messages
CREATE OR REPLACE FUNCTION teams.backfill_message_hashes()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    UPDATE teams.messages
    SET message_hash = teams.generate_message_hash(
        channel_id,
        sender_id,
        timestamp,
        content
    )
    WHERE message_hash IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to create or update conversation
CREATE OR REPLACE FUNCTION teams.upsert_conversation(
    p_id VARCHAR,
    p_name VARCHAR,
    p_type VARCHAR,
    p_team_id VARCHAR DEFAULT NULL,
    p_team_name VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO teams.conversations (id, name, type, team_id, team_name, metadata, last_activity)
    VALUES (p_id, p_name, p_type, p_team_id, p_team_name, p_metadata, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update extraction checkpoint
CREATE OR REPLACE FUNCTION teams.update_checkpoint(
    p_conversation_id VARCHAR,
    p_last_message_id VARCHAR,
    p_last_message_timestamp TIMESTAMPTZ,
    p_messages_extracted INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO teams.extraction_checkpoints (
        conversation_id,
        last_message_id,
        last_message_timestamp,
        last_extraction_timestamp,
        total_extracted,
        messages_since_last
    )
    VALUES (
        p_conversation_id,
        p_last_message_id,
        p_last_message_timestamp,
        NOW(),
        p_messages_extracted,
        p_messages_extracted
    )
    ON CONFLICT (conversation_id)
    DO UPDATE SET
        last_message_id = EXCLUDED.last_message_id,
        last_message_timestamp = EXCLUDED.last_message_timestamp,
        last_extraction_timestamp = NOW(),
        total_extracted = teams.extraction_checkpoints.total_extracted + p_messages_extracted,
        messages_since_last = p_messages_extracted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT ALL PRIVILEGES ON teams.conversations TO teams_admin;
GRANT ALL PRIVILEGES ON teams.extraction_checkpoints TO teams_admin;
GRANT SELECT ON teams.message_threads TO teams_admin;
GRANT SELECT ON teams.conversations TO mcp_reader;
GRANT SELECT ON teams.extraction_checkpoints TO mcp_reader;
GRANT SELECT ON teams.message_threads TO mcp_reader;

-- ============================================
-- 8. OPTIONAL: BACKFILL MESSAGE HASHES
-- ============================================

-- Uncomment to backfill message hashes for existing data
-- SELECT teams.backfill_message_hashes();

COMMENT ON TABLE teams.conversations IS 'Stores Teams conversations (channels, chats, meetings)';
COMMENT ON TABLE teams.extraction_checkpoints IS 'Tracks last extraction point per conversation for incremental sync';
COMMENT ON COLUMN teams.messages.message_hash IS 'SHA-256 hash for deduplication';
COMMENT ON COLUMN teams.messages.conversation_id IS 'Reference to parent conversation';
COMMENT ON COLUMN teams.messages.parent_message_id IS 'Reference to parent message for threaded replies';
COMMENT ON COLUMN teams.messages.reply_count IS 'Number of replies to this message';
