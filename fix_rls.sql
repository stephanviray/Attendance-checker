-- First, make sure RLS is enabled on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Company can view all employee profiles" ON public.profiles;
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon access for testing" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated access for testing" ON public.profiles;
DROP POLICY IF EXISTS "Company can update employee profiles" ON public.profiles;

-- Create a policy that allows full access from the anonymous key for testing
CREATE POLICY "Allow anon access for testing"
ON public.profiles
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Create a policy that allows authenticated users to access all profiles
CREATE POLICY "Allow authenticated access for testing"
ON public.profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create a specific policy that allows companies to update employee profiles
CREATE POLICY "Company can update employee profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'company'
    )
)
WITH CHECK (
    (role = 'employee') AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'company'
    )
);

-- For debugging purposes, let's check if the policy was created successfully
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Drop existing policies
DROP POLICY IF EXISTS company_manage_attendance ON public.attendance;
DROP POLICY IF EXISTS employee_read_own_attendance ON public.attendance;

-- Create new policies for attendance table
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow company users to manage attendance records
CREATE POLICY company_manage_attendance ON public.attendance
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'company'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'company'
        )
    );

-- Allow employees to read their own attendance records
CREATE POLICY employee_read_own_attendance ON public.attendance
    FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON public.attendance TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.attendance_id_seq TO authenticated;

-- For debugging purposes, let's check if the policies were created successfully
SELECT * FROM pg_policies WHERE tablename = 'attendance'; 