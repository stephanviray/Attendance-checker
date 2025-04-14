// Script to update database schema
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SQL script content
const sqlScript = `
-- Drop existing tables first to avoid conflicts
DROP TABLE IF EXISTS public.attendance;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    middle_initial TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        COALESCE(first_name, '') || ' ' || 
        CASE WHEN middle_initial IS NOT NULL AND middle_initial != '' THEN middle_initial || '. ' ELSE '' END || 
        COALESCE(last_name, '')
    ) STORED,
    address TEXT,
    phone_number TEXT,
    salary NUMERIC(10, 2),
    position TEXT,
    department TEXT,
    custom_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'company', 'admin')),
    company_id UUID REFERENCES auth.users(id),
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'present',
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on attendance table
CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_check_in ON public.attendance(check_in);
CREATE INDEX idx_attendance_status ON public.attendance(status);
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_archived ON public.profiles(archived);
CREATE INDEX idx_profiles_department ON public.profiles(department);
CREATE INDEX idx_profiles_full_name ON public.profiles(full_name);

-- Create RPC to safely create a profile
DROP FUNCTION IF EXISTS public.create_profile_for_user;
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
    user_id UUID,
    user_email TEXT,
    user_role TEXT,
    first_name TEXT,
    last_name TEXT,
    middle_initial TEXT DEFAULT NULL,
    address TEXT DEFAULT NULL,
    phone_number TEXT DEFAULT NULL,
    "position" TEXT DEFAULT NULL,
    department TEXT DEFAULT NULL,
    salary NUMERIC DEFAULT NULL,
    custom_id TEXT DEFAULT NULL,
    company_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Insert the profile
    INSERT INTO public.profiles (
        id,
        email,
        role,
        first_name,
        last_name,
        middle_initial,
        address,
        phone_number,
        "position",
        department,
        salary,
        custom_id,
        company_id,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        user_email,
        user_role,
        first_name,
        last_name,
        middle_initial,
        address,
        phone_number,
        "position",
        department,
        salary,
        custom_id,
        company_id,
        now(),
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing policies before adding new ones
DROP POLICY IF EXISTS user_read_own_profile ON public.profiles;
DROP POLICY IF EXISTS user_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS company_read_employee_profiles ON public.profiles;
DROP POLICY IF EXISTS admin_manage_profiles ON public.profiles;
DROP POLICY IF EXISTS company_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS company_manage_attendance ON public.attendance;
DROP POLICY IF EXISTS employee_read_own_attendance ON public.attendance;

-- Drop existing archive policies first
DROP POLICY IF EXISTS "Company can archive employees" ON public.profiles;
DROP POLICY IF EXISTS "Company can restore employees" ON public.profiles;

-- Row Level Security Policies
-- Profiles table policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY user_read_own_profile ON public.profiles
    FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY user_update_own_profile ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Allow all authenticated users to read profiles
CREATE POLICY read_all_profiles ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can update all profiles
CREATE POLICY admin_manage_profiles ON public.profiles
    FOR ALL USING (
        (auth.jwt() ->> 'role' = 'admin')
    );

-- Company can update their own profile
CREATE POLICY company_update_own_profile ON public.profiles
    FOR UPDATE USING (
        (auth.jwt() ->> 'role' = 'company') AND 
        (id = auth.uid())
    );

-- Company can update employee profiles under their company
CREATE POLICY company_update_employees ON public.profiles
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'company' AND
        company_id = auth.uid()
    );

-- Create policy for archiving/restoring employees
CREATE POLICY "Company can manage employee archive status" ON public.profiles
    FOR UPDATE USING (
        -- Allow companies to archive/restore their employees
        auth.role() IN ('authenticated') AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND
            (role = 'company' OR role = 'admin')
        )
    )
    WITH CHECK (
        -- Only allow updating the archived field
        coalesce(auth.role() IN ('authenticated') AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND
            (role = 'company' OR role = 'admin')
        ), false)
    );

-- Attendance table policies
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Company/admin can create and update attendance records for their employees
CREATE POLICY company_manage_attendance ON public.attendance
    FOR ALL USING (
        (auth.jwt() ->> 'role' = 'company' OR auth.jwt() ->> 'role' = 'admin') AND
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = employee_id AND p.company_id = auth.uid()
        )
    );

-- Employees can only read their own attendance records
CREATE POLICY employee_read_own_attendance ON public.attendance
    FOR SELECT USING (employee_id = auth.uid());
`;

async function updateDatabaseSchema() {
  console.log('Starting database schema update...');
  
  try {
    // Execute the SQL script using exec_sql function
    const { data, error } = await supabaseClient.rpc('exec_sql', {
      sql_query: sqlScript
    });
    
    if (error) {
      console.error('Error updating database schema:', error);
    } else {
      console.log('Database schema updated successfully!');
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('Exception updating database schema:', err);
  }
}

// Execute the update
updateDatabaseSchema()
  .then(() => console.log('Schema update process completed'))
  .catch(err => console.error('Schema update process failed:', err)); 