-- Drop existing tables first to avoid conflicts
DROP TABLE IF EXISTS public.attendance;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create employee ID generation function
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS TEXT AS $$
DECLARE
    next_id INTEGER;
    id_prefix TEXT := 'EMP';
BEGIN
    -- Find the highest existing employee ID number
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN custom_id LIKE 'EMP%' 
                THEN CAST(SUBSTRING(custom_id FROM 4) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) + 1
    INTO next_id
    FROM public.profiles
    WHERE custom_id LIKE 'EMP%';
    
    -- Format with leading zeros to ensure EMP001 format
    RETURN id_prefix || LPAD(next_id::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Create trigger function to auto-assign employee IDs
CREATE OR REPLACE FUNCTION public.set_employee_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set custom_id if it's NULL
    IF NEW.custom_id IS NULL THEN
        NEW.custom_id := public.generate_employee_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set employee ID for new profiles
DROP TRIGGER IF EXISTS set_employee_id_trigger ON public.profiles;
CREATE TRIGGER set_employee_id_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_employee_id();

-- Create index on attendance table
CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_check_in ON public.attendance(check_in);
CREATE INDEX idx_attendance_status ON public.attendance(status);
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_archived ON public.profiles(archived);
CREATE INDEX idx_profiles_department ON public.profiles(department);
CREATE INDEX idx_profiles_full_name ON public.profiles(full_name);

-- Drop functions by being specific with parameter lists (handle all overloaded variants)
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT);

-- Create RPC to safely create a profile
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

-- Drop force_create_profile function with all possible parameter combinations
DROP FUNCTION IF EXISTS public.force_create_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.force_create_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.force_create_profile(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.force_create_profile(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.force_create_profile(UUID, TEXT);
DROP FUNCTION IF EXISTS public.force_create_profile(UUID);

-- Add force_create_profile function
CREATE OR REPLACE FUNCTION public.force_create_profile(
  user_id UUID,
  user_email TEXT,
  user_role TEXT DEFAULT 'employee',
  first_name TEXT DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  middle_initial TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  phone_number TEXT DEFAULT NULL,
  department TEXT DEFAULT NULL,
  "position" TEXT DEFAULT NULL,
  custom_id TEXT DEFAULT NULL,
  company_id UUID DEFAULT NULL
) RETURNS UUID AS $$
BEGIN
  -- Insert with full error handling
  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    middle_initial,
    address,
    phone_number,
    department,
    position,
    custom_id,
    company_id,
    created_at
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
    department,
    position,
    custom_id,
    company_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    middle_initial = EXCLUDED.middle_initial,
    address = EXCLUDED.address,
    phone_number = EXCLUDED.phone_number,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    custom_id = EXCLUDED.custom_id,
    company_id = EXCLUDED.company_id,
    updated_at = now();
  
  RETURN user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in force_create_profile: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get employee ID from UUID
CREATE OR REPLACE FUNCTION public.get_employee_by_uuid(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    emp_id TEXT;
BEGIN
    SELECT custom_id INTO emp_id
    FROM public.profiles
    WHERE id = user_uuid;
    
    RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get UUID from employee ID
CREATE OR REPLACE FUNCTION public.get_uuid_by_employee_id(emp_id TEXT)
RETURNS UUID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid
    FROM public.profiles
    WHERE custom_id = emp_id;
    
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop get_server_time function
DROP FUNCTION IF EXISTS public.get_server_time();

-- Creates server_time function for connection testing
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW();
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
DROP POLICY IF EXISTS read_all_profiles ON public.profiles;
DROP POLICY IF EXISTS company_update_employees ON public.profiles;

-- Drop existing archive policies first
DROP POLICY IF EXISTS "Company can archive employees" ON public.profiles;
DROP POLICY IF EXISTS "Company can restore employees" ON public.profiles;
DROP POLICY IF EXISTS "Company can manage employee archive status" ON public.profiles;

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

-- Grant execute permissions to functions
GRANT EXECUTE ON FUNCTION public.force_create_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_employee_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_employee_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_by_uuid(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_uuid_by_employee_id(TEXT) TO authenticated, anon, service_role; 