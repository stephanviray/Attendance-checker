-- Function to generate employee IDs
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

-- Function to connect UUID to employee ID (if needed)
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

-- Function to get UUID by employee ID (if needed)
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

-- Grant execute permissions to all functions
GRANT EXECUTE ON FUNCTION public.generate_employee_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_employee_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_by_uuid(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_uuid_by_employee_id(TEXT) TO authenticated, anon, service_role; 