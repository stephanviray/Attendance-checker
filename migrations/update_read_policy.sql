-- Migration script to update employee list viewing permissions
-- This script updates the RLS policy to allow all authenticated users to view employee lists

-- Drop existing restrictive policy
DROP POLICY IF EXISTS company_read_profiles ON public.profiles;

-- Create new policy allowing all authenticated users to read profiles
CREATE POLICY read_all_profiles ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Verify the policy was created
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'read_all_profiles';
    
    IF policy_count = 0 THEN
        RAISE EXCEPTION 'Policy read_all_profiles was not created successfully.';
    ELSE
        RAISE NOTICE 'Policy read_all_profiles created successfully.';
    END IF;
END $$; 