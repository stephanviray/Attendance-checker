// Script to execute SQL to create the updated force_create_profile function
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateFunctionInDatabase() {
  console.log('Starting function update process...');
  
  try {
    // Read SQL file
    const sqlContent = fs.readFileSync('./fix_profile_creation.sql', 'utf8');
    console.log('SQL file read successfully');
    
    // Execute the SQL using Supabase RPC call
    const { data, error } = await supabaseClient.rpc('exec_sql', {
      sql_query: sqlContent
    });
    
    if (error) {
      console.error('Error updating function in database:', error);
    } else {
      console.log('Function updated successfully in database:', data);
    }
  } catch (err) {
    console.error('Exception updating function:', err);
  }
}

// Execute the update
updateFunctionInDatabase()
  .then(() => console.log('Process completed'))
  .catch(err => console.error('Process failed:', err)); 