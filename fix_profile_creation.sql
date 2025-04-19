-- First drop the function if it exists
DROP FUNCTION IF EXISTS public.force_create_profile;

-- Create a comprehensive version with all employee fields
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
  position TEXT DEFAULT NULL,
  company_id UUID DEFAULT NULL,
  gender TEXT DEFAULT NULL,
  type TEXT DEFAULT NULL
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
    full_name,
    company_id,
    gender,
    type,
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
    CONCAT_WS(' ', first_name, CASE WHEN middle_initial IS NOT NULL AND length(middle_initial) > 0 THEN middle_initial || '.' ELSE NULL END, last_name),
    company_id,
    gender,
    type,
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
    full_name = EXCLUDED.full_name,
    company_id = EXCLUDED.company_id,
    gender = EXCLUDED.gender,
    type = EXCLUDED.type,
    updated_at = now();
  
  RETURN user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in force_create_profile: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.force_create_profile TO authenticated, anon, service_role; 