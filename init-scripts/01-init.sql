-- PostgreSQL schema for Teams Message Extractor

-- Create schema
CREATE SCHEMA IF NOT EXISTS teams;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Messages table
CREATE TABLE teams.messages (
    id BIGSERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    channel_id VARCHAR(255),
    channel_name VARCHAR(500),
    content TEXT NOT NULL,
    sender_id VARCHAR(255),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL,
    url TEXT,
    type VARCHAR(50) DEFAULT 'message',
    thread_id VARCHAR(255),
    attachments JSONB DEFAULT '[]'::jsonb,
    reactions JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_channel_id ON teams.messages(channel_id);
CREATE INDEX idx_messages_sender_id ON teams.messages(sender_id);
CREATE INDEX idx_messages_timestamp ON teams.messages(timestamp DESC);
CREATE INDEX idx_messages_extracted_at ON teams.messages(extracted_at DESC);
CREATE INDEX idx_messages_thread_id ON teams.messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_type ON teams.messages(type);

-- Full-text search index
CREATE INDEX idx_messages_content_fts ON teams.messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_messages_sender_name_trgm ON teams.messages USING gin(sender_name gin_trgm_ops);
CREATE INDEX idx_messages_channel_name_trgm ON teams.messages USING gin(channel_name gin_trgm_ops);

-- Extraction sessions table
CREATE TABLE teams.extraction_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    messages_extracted INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Statistics table
CREATE TABLE teams.statistics (
    id BIGSERIAL PRIMARY KEY,
    stat_date DATE DEFAULT CURRENT_DATE,
    total_messages INTEGER DEFAULT 0,
    total_channels INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    messages_today INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stat_date)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION teams.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER messages_updated_at
    BEFORE UPDATE ON teams.messages
    FOR EACH ROW
    EXECUTE FUNCTION teams.update_updated_at();

-- Function to update statistics
CREATE OR REPLACE FUNCTION teams.update_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO teams.statistics (stat_date, total_messages, messages_today)
    VALUES (
        CURRENT_DATE,
        1,
        1
    )
    ON CONFLICT (stat_date)
    DO UPDATE SET
        total_messages = teams.statistics.total_messages + 1,
        messages_today = teams.statistics.messages_today + 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for statistics
CREATE TRIGGER messages_statistics
    AFTER INSERT ON teams.messages
    FOR EACH ROW
    EXECUTE FUNCTION teams.update_statistics();

-- Create read-only user for MCP server
CREATE USER mcp_reader WITH PASSWORD 'mcp_reader_password';
GRANT USAGE ON SCHEMA teams TO mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA teams TO mcp_reader;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA teams TO teams_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA teams TO teams_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA teams TO teams_admin;
