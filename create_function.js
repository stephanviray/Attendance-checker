// Supabase configuration
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createFunction() {
  console.log('Creating force_create_profile function...');
  
  const sqlQuery = `
  -- First drop the function if it exists
  DROP FUNCTION IF EXISTS public.force_create_profile;
  
  -- Create a simpler version without DECLARE
  CREATE OR REPLACE FUNCTION public.force_create_profile(
    user_id UUID,
    user_email TEXT,
    user_role TEXT DEFAULT 'employee',
    first_name TEXT DEFAULT NULL,
    last_name TEXT DEFAULT NULL,
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
      full_name,
      company_id,
      created_at
    )
    VALUES (
      user_id,
      user_email,
      user_role,
      first_name,
      last_name,
      CONCAT_WS(' ', first_name, last_name),
      company_id,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      company_id = EXCLUDED.company_id,
      updated_at = now();
    
    RETURN user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in force_create_profile: %', SQLERRM;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  -- Grant execute permissions
  GRANT EXECUTE ON FUNCTION public.force_create_profile TO authenticated, anon, service_role;
  `;
  
  try {
    // Execute SQL using the exec_sql RPC function
    const { data, error } = await supabaseClient.rpc('exec_sql', {
      sql_query: sqlQuery
    });
    
    if (error) {
      console.error('Error creating function:', error);
      return;
    }
    
    console.log('Function created successfully:', data);
  } catch (err) {
    console.error('Exception creating function:', err);
  }
}

// Execute the function
createFunction()
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error:', err)); 