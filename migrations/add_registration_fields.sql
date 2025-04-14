-- Migration script to add registration form fields and update existing records
-- This script handles adding columns safely (only if they don't exist)

-- Check and add missing columns
DO $$
BEGIN
    -- Add first_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_name') THEN
        ALTER TABLE profiles ADD COLUMN first_name TEXT;
    END IF;

    -- Add last_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_name') THEN
        ALTER TABLE profiles ADD COLUMN last_name TEXT;
    END IF;

    -- Add middle_initial if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'middle_initial') THEN
        ALTER TABLE profiles ADD COLUMN middle_initial TEXT;
    END IF;

    -- Add address if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
        ALTER TABLE profiles ADD COLUMN address TEXT;
    END IF;

    -- Add phone_number if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_number') THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    END IF;

    -- Add salary if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'salary') THEN
        ALTER TABLE profiles ADD COLUMN salary NUMERIC(10, 2);
    END IF;

    -- Add position if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'position') THEN
        ALTER TABLE profiles ADD COLUMN position TEXT;
    END IF;

    -- Add department if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'department') THEN
        ALTER TABLE profiles ADD COLUMN department TEXT;
    END IF;

    -- Add custom_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'custom_id') THEN
        ALTER TABLE profiles ADD COLUMN custom_id TEXT;
        -- Add uniqueness constraint
        ALTER TABLE profiles ADD CONSTRAINT profiles_custom_id_key UNIQUE (custom_id);
    END IF;

    -- Add archived if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'archived') THEN
        ALTER TABLE profiles ADD COLUMN archived BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create missing indexes
DO $$
BEGIN
    -- Add index on role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_role') THEN
        CREATE INDEX idx_profiles_role ON profiles(role);
    END IF;

    -- Add index on archived if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_archived') THEN
        CREATE INDEX idx_profiles_archived ON profiles(archived);
    END IF;

    -- Add index on department if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_department') THEN
        CREATE INDEX idx_profiles_department ON profiles(department);
    END IF;

    -- Add index on full_name if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_full_name') THEN
        CREATE INDEX idx_profiles_full_name ON profiles(full_name);
    END IF;
END $$;

-- Handle existing records with full_name but no component parts
UPDATE profiles 
SET 
    first_name = SPLIT_PART(full_name, ' ', 1),
    last_name = SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
WHERE 
    (first_name IS NULL OR first_name = '') AND 
    full_name IS NOT NULL AND 
    full_name != '' AND
    POSITION(' ' IN full_name) > 0;

-- For records with only one name component in full_name
UPDATE profiles 
SET 
    first_name = full_name
WHERE 
    (first_name IS NULL OR first_name = '') AND 
    full_name IS NOT NULL AND 
    full_name != '' AND
    POSITION(' ' IN full_name) = 0;

-- Add company update employees policy if it doesn't exist
DO $$
BEGIN
    -- Drop the policy first to avoid errors (it's idempotent)
    DROP POLICY IF EXISTS company_update_employees ON profiles;
    
    -- Create the policy
    CREATE POLICY company_update_employees ON profiles
        FOR UPDATE USING (
            auth.jwt() ->> 'role' = 'company' AND
            company_id = auth.uid()
        );
END $$; 