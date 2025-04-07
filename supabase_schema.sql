-- Drop existing tables first to avoid conflicts
DROP TABLE IF EXISTS public.attendance;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    custom_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'company')),
    department TEXT,
    position TEXT,
    company_id UUID REFERENCES auth.users(id),
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

-- Create RPC to safely create a profile
DROP FUNCTION IF EXISTS public.create_profile_for_user;
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
    user_id UUID,
    user_email TEXT,
    user_role TEXT,
    user_full_name TEXT,
    company_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Insert the profile
    INSERT INTO public.profiles (
        id,
        email,
        role,
        full_name,
        company_id,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        user_email,
        user_role,
        user_full_name,
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
DROP POLICY IF EXISTS company_manage_attendance ON public.attendance;
DROP POLICY IF EXISTS employee_read_own_attendance ON public.attendance;

-- Row Level Security Policies
-- Profiles table policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY user_read_own_profile ON public.profiles
    FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY user_update_own_profile ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Company can read all profiles under their company
CREATE POLICY company_read_profiles ON public.profiles
    FOR SELECT USING (
        (auth.jwt() ->> 'role' = 'company') AND 
        (company_id = auth.uid() OR id = auth.uid())
    );

-- Company can update their own profile
CREATE POLICY company_update_own_profile ON public.profiles
    FOR UPDATE USING (
        (auth.jwt() ->> 'role' = 'company') AND 
        (id = auth.uid())
    );

-- Attendance table policies
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Company can create and update attendance records for their employees
CREATE POLICY company_manage_attendance ON public.attendance
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'company' AND
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = employee_id AND p.company_id = auth.uid()
        )
    );

-- Employees can only read their own attendance records
CREATE POLICY employee_read_own_attendance ON public.attendance
    FOR SELECT USING (employee_id = auth.uid()); 