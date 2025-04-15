const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
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

// Helper function to read CSV files
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Create SQL statements to insert auth users directly
async function createAuthUsersSql() {
  try {
    // Read the profiles data to get user information
    const profilesPath = path.join(__dirname, 'samples', 'profiles_sample.csv');
    const profilesData = await readCsvFile(profilesPath);
    
    console.log('Generating SQL to insert auth users...');
    
    // Create SQL to insert users directly into auth.users table
    // This is a fallback method when the Admin API doesn't work
    let sqlStatements = '';
    
    for (const profile of profilesData) {
      // Generate a hashed password (this is a placeholder, actual password hashing is more complex)
      // In production, you would use bcrypt or another secure algorithm
      const hashedPassword = 'HASH_PASSWORD_PLACEHOLDER'; 
      
      const sql = `
-- Insert user ${profile.email}
INSERT INTO auth.users (
  id, email, email_confirmed_at, encrypted_password, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '${profile.id}', 
  '${profile.email}', 
  NOW(), 
  '${hashedPassword}',
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "${profile.first_name}", "last_name": "${profile.last_name}"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert identities
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, created_at, updated_at
) VALUES (
  '${profile.id}',
  '${profile.id}',
  '{"sub": "${profile.id}", "email": "${profile.email}"}',
  'email',
  NOW(),
  NOW()
) ON CONFLICT (id, provider) DO NOTHING;

`;
      sqlStatements += sql;
    }
    
    // Write the SQL to a file
    const outputPath = path.join(__dirname, 'insert_auth_users.sql');
    fs.writeFileSync(outputPath, sqlStatements);
    
    console.log(`SQL statements written to ${outputPath}`);
    console.log('To use this SQL:');
    console.log('1. Connect to your Supabase PostgreSQL database directly');
    console.log('2. Execute the SQL statements to create the auth users');
    console.log('3. Then run npm run import-sample-data to import the profile data');
    
    // Try to execute the SQL if we have access
    console.log('\nAttempting to execute SQL via exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_statement: sqlStatements
    });
    
    if (error) {
      console.error('Error executing SQL:', error);
      console.log('Please run the SQL manually as described above.');
    } else {
      console.log('SQL executed successfully!');
      console.log('You can now run npm run import-sample-data to import the profile data');
    }
    
  } catch (error) {
    console.error('Error creating auth users SQL:', error);
    process.exit(1);
  }
}

// Run the function
createAuthUsersSql(); 