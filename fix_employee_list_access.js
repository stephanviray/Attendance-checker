const { createClient } = require('@supabase/supabase-js');

// Supabase connection details from the main app
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

async function main() {
  console.log('Starting policy update process...');
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    console.log('Dropping existing restrictive policy...');
    
    // First, drop the existing restrictive policy
    const { error: dropError } = await supabase.rpc('exec_sql', { 
      sql_query: `DROP POLICY IF EXISTS company_read_profiles ON public.profiles;` 
    });
    
    if (dropError) {
      console.error('Failed to drop existing policy:', dropError);
      return;
    }
    
    console.log('Creating new policy for all authenticated users...');
    
    // Create new policy allowing all authenticated users to read profiles
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        CREATE POLICY read_all_profiles ON public.profiles
        FOR SELECT USING (auth.role() = 'authenticated');
      ` 
    });
    
    if (createError) {
      console.error('Failed to create new policy:', createError);
      return;
    }
    
    console.log('Policy successfully updated!');
    
    // Verify the policy was created
    const { data: policies, error: policyError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        SELECT policyname, cmd, roles, qual 
        FROM pg_policies 
        WHERE tablename = 'profiles'
        ORDER BY policyname;
      `
    });
    
    if (policyError) {
      console.error('Failed to verify policies:', policyError);
      return;
    }
    
    console.log('Current policies on profiles table:');
    console.table(policies);
    
    console.log('✅ Employee list access has been fixed. All authenticated users can now view employee lists.');
    
  } catch (error) {
    console.error('Unexpected error during policy update:', error);
  }
}

main()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  }); 