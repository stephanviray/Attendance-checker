-- Create tables for profile synchronization between mobile and web

-- Table for shared profile data
CREATE TABLE IF NOT EXISTS shared_profile_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,
    last_synced_from VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE shared_profile_data ENABLE ROW LEVEL SECURITY;

-- Create policy for select
CREATE POLICY "Users can view their own shared profile data"
    ON shared_profile_data
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy for insert
CREATE POLICY "Users can insert their own shared profile data"
    ON shared_profile_data
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy for update
CREATE POLICY "Users can update their own shared profile data"
    ON shared_profile_data
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Table for sync tokens
CREATE TABLE IF NOT EXISTS profile_sync_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    used_at TIMESTAMPTZ,
    
    CONSTRAINT status_check CHECK (status IN ('active', 'used', 'expired'))
);

-- Enable RLS (Row Level Security)
ALTER TABLE profile_sync_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy for select
CREATE POLICY "Users can view their own sync tokens"
    ON profile_sync_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy for insert
CREATE POLICY "Users can insert their own sync tokens"
    ON profile_sync_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy for update
CREATE POLICY "Users can update their own sync tokens"
    ON profile_sync_tokens
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_shared_profile_data_user_id ON shared_profile_data(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_sync_tokens_user_id ON profile_sync_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_sync_tokens_status ON profile_sync_tokens(status); 