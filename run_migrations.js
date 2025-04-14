const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase connection details from the main app
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

async function main() {
  console.log('Starting migration process...');
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Get the migration file
  const migrationPath = path.join(__dirname, 'migrations', 'add_registration_fields.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Migration file loaded successfully');
  console.log('Executing migration...');
  
  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSql 
    });
    
    if (error) {
      console.error('Migration failed:', error);
      return;
    }
    
    console.log('Migration completed successfully');
    
    // Verify the changes
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'profiles'
        ORDER BY column_name;
      `
    });
    
    if (columnsError) {
      console.error('Failed to verify columns:', columnsError);
      return;
    }
    
    console.log('Current columns in profiles table:');
    console.table(columns);
    
    // Verify indexes
    const { data: indexes, error: indexesError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'profiles'
        ORDER BY indexname;
      `
    });
    
    if (indexesError) {
      console.error('Failed to verify indexes:', indexesError);
      return;
    }
    
    console.log('Current indexes on profiles table:');
    console.table(indexes);
    
    console.log('Migration process completed!');
  } catch (error) {
    console.error('Unexpected error during migration:', error);
  }
}

main()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  }); 