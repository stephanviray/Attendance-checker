const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  try {
    console.log('Checking database schema...');
    
    // Check profiles table schema
    console.log('\nProfiles table schema:');
    const { data: profilesSchema, error: profilesError } = await supabase.rpc('exec_sql', {
      sql_statement: `
        SELECT column_name, data_type, is_nullable, column_default, identity_generation
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        ORDER BY ordinal_position;
      `
    });
    
    if (profilesError) {
      console.error('Error fetching profiles schema:', profilesError);
    } else {
      console.table(profilesSchema);
    }
    
    // Check for any triggers on the profiles table
    console.log('\nTriggers on profiles table:');
    const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', {
      sql_statement: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'profiles';
      `
    });
    
    if (triggerError) {
      console.error('Error fetching trigger information:', triggerError);
    } else {
      console.table(triggerData || []);
    }
    
    // Check for any computed columns or special constraints
    console.log('\nGenerated columns on profiles table:');
    const { data: generatedCols, error: generatedError } = await supabase.rpc('exec_sql', {
      sql_statement: `
        SELECT column_name, generation_expression
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND is_generated = 'ALWAYS';
      `
    });
    
    if (generatedError) {
      console.error('Error fetching generated column information:', generatedError);
    } else {
      console.table(generatedCols || []);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

// Run the schema check
checkSchema(); 