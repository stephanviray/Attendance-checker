-- Create a function to generate sequential employee IDs (EMP001, EMP002, etc.)
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
$$ LANGUAGE plpgsql;

-- Modify the create_profile_for_user function to use the new employee ID generator
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
    user_id UUID,
    user_email TEXT,
    user_role TEXT,
    user_full_name TEXT,
    company_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
    employee_id TEXT;
BEGIN
    -- Generate employee ID for employee roles
    IF user_role = 'employee' THEN
        employee_id := public.generate_employee_id();
    ELSE
        employee_id := NULL; -- For non-employee roles like 'company'
    END IF;

    -- Insert the profile with the generated employee ID
    INSERT INTO public.profiles (
        id,
        email,
        role,
        full_name,
        company_id,
        custom_id,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        user_email,
        user_role,
        user_full_name,
        company_id,
        employee_id,
        now(),
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 