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

// Helper function to convert string values to appropriate types
function convertDataTypes(data, tableName) {
  const result = { ...data };
  
  if (tableName === 'profiles') {
    // Remove full_name as it's likely auto-generated in the database
    delete result.full_name;
    
    result.salary = result.salary ? parseFloat(result.salary) : null;
    result.archived = result.archived === 'true';
    // Handle date fields properly
    if (result.hire_date) {
      result.hire_date = result.hire_date.trim() || null;
    }
  } else if (tableName === 'attendance') {
    result.check_in = result.check_in || null;
    result.check_out = result.check_out === 'null' ? null : result.check_out;
    // Convert string ID to integer if needed
    if (result.id) {
      result.id = parseInt(result.id, 10);
    }
  } else if (tableName === 'leave_requests') {
    // Convert string ID to integer if needed
    if (result.id) {
      result.id = parseInt(result.id, 10);
    }
    // Handle date fields properly
    if (result.start_date) {
      result.start_date = result.start_date.trim() || null;
    }
    if (result.end_date) {
      result.end_date = result.end_date.trim() || null;
    }
  }
  
  return result;
}

// Check database schema to understand the structure
async function checkDbSchema() {
  try {
    console.log('Checking database schema...');
    
    // Check foreign key constraint on profiles table
    const { data: fkData, error: fkError } = await supabase.rpc('exec_sql', {
      sql_statement: `
        SELECT
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='profiles';
      `
    });
    
    if (fkError) {
      console.error('Error checking foreign key constraints:', fkError);
    } else {
      console.log('Foreign key constraints on profiles table:');
      console.table(fkData || []);
      return fkData;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking schema:', error);
    return null;
  }
}

// Create a user in auth.users via API
async function createAuthUser(email, password, userData) {
  try {
    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase.auth.admin.listUsers({
      filter: { email }
    });
    
    if (checkError) {
      console.error(`Error checking for existing user ${email}:`, checkError);
      return null;
    }
    
    // If user already exists, return their UUID
    if (existingUsers && existingUsers.users && existingUsers.users.length > 0) {
      console.log(`User ${email} already exists with ID ${existingUsers.users[0].id}`);
      return existingUsers.users[0].id;
    }
    
    // Create the user with a specified UUID if provided
    const options = {
      email,
      password: password || 'Password123!',
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    };
    
    if (userData.id) {
      options.id = userData.id;
    }
    
    const { data, error } = await supabase.auth.admin.createUser(options);
    
    if (error) {
      console.error(`Error creating auth user ${email}:`, error);
      return null;
    }
    
    console.log(`Created auth user ${email} with ID ${data.user.id}`);
    return data.user.id;
  } catch (error) {
    console.error(`Error in createAuthUser for ${email}:`, error);
    return null;
  }
}

// Main import function
async function importSampleData() {
  try {
    console.log('Starting sample data import...');
    
    // First, check the database schema to understand foreign key relationships
    const fkConstraints = await checkDbSchema();
    
    // Import profiles
    console.log('\nImporting profiles...');
    const profilesPath = path.join(__dirname, 'samples', 'profiles_sample.csv');
    const profilesData = await readCsvFile(profilesPath);
    
    // If we have foreign key constraints to auth.users, we need to create auth users first
    const needsAuthUsers = fkConstraints && fkConstraints.some(
      fk => fk.foreign_table_name?.includes('auth') && fk.foreign_column_name === 'id'
    );
    
    console.log(`Auth users ${needsAuthUsers ? 'are' : 'are not'} required based on foreign key constraints`);
    
    for (const profile of profilesData) {
      try {
        // If we need auth users, create them first
        if (needsAuthUsers) {
          const userId = await createAuthUser(
            profile.email, 
            'Password123!', 
            {
              id: profile.id,
              first_name: profile.first_name,
              last_name: profile.last_name
            }
          );
          
          if (!userId) {
            console.error(`Skipping profile for ${profile.email} because auth user creation failed`);
            continue;
          }
          
          // Ensure the profile ID matches the auth user ID
          profile.id = userId;
        }
        
        // Now insert the profile
        const convertedProfile = convertDataTypes(profile, 'profiles');
        const { data, error } = await supabase
          .from('profiles')
          .upsert(convertedProfile, { onConflict: 'id', returning: 'minimal' });
        
        if (error) {
          console.error(`Error importing profile ${profile.email}:`, error);
          console.error('Failed data:', convertedProfile);
        } else {
          console.log(`Successfully imported profile for ${profile.email}`);
        }
      } catch (profileError) {
        console.error(`Unexpected error processing profile ${profile.email}:`, profileError);
      }
    }
    
    // Only proceed with attendance and leave requests if profiles were successful
    console.log('\nImporting attendance records...');
    const attendancePath = path.join(__dirname, 'samples', 'attendance_sample.csv');
    const attendanceData = await readCsvFile(attendancePath);
    
    for (const record of attendanceData) {
      try {
        const convertedRecord = convertDataTypes(record, 'attendance');
        const { error } = await supabase
          .from('attendance')
          .upsert(convertedRecord, { onConflict: 'id', returning: 'minimal' });
        
        if (error) {
          console.error(`Error importing attendance record ${record.id}:`, error);
        } else {
          console.log(`Successfully imported attendance record ${record.id}`);
        }
      } catch (attendanceError) {
        console.error(`Unexpected error processing attendance record ${record.id}:`, attendanceError);
      }
    }
    
    console.log('\nImporting leave requests...');
    const leavePath = path.join(__dirname, 'samples', 'leave_requests_sample.csv');
    const leaveData = await readCsvFile(leavePath);
    
    for (const request of leaveData) {
      try {
        const convertedRequest = convertDataTypes(request, 'leave_requests');
        const { error } = await supabase
          .from('leave_requests')
          .upsert(convertedRequest, { onConflict: 'id', returning: 'minimal' });
        
        if (error) {
          console.error(`Error importing leave request ${request.id}:`, error);
        } else {
          console.log(`Successfully imported leave request ${request.id}`);
        }
      } catch (leaveError) {
        console.error(`Unexpected error processing leave request ${request.id}:`, leaveError);
      }
    }
    
    console.log('\nSample data import completed!');
  } catch (error) {
    console.error('Error importing sample data:', error);
    process.exit(1);
  }
}

// Run the import
importSampleData(); 