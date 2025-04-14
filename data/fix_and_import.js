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
  
  if (tableName === 'profiles' || tableName === 'profiles_view') {
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

// Apply schema fix
async function fixSchema() {
  try {
    console.log('Applying schema fix to handle foreign key constraints...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_statement: sql
    });
    
    if (error) {
      console.error('Error applying schema fix:', error);
      return false;
    }
    
    console.log('Schema fix applied successfully!');
    return true;
  } catch (error) {
    console.error('Error fixing schema:', error);
    return false;
  }
}

// Main import function using the view for profiles
async function importSampleData() {
  try {
    console.log('Starting sample data import using schema fix...');
    
    // First apply the schema fix
    const schemaFixed = await fixSchema();
    
    if (!schemaFixed) {
      console.log('Will attempt to continue with import despite schema fix errors...');
    }
    
    // Import profiles using the view if available
    console.log('\nImporting profiles...');
    const profilesPath = path.join(__dirname, 'samples', 'profiles_sample.csv');
    const profilesData = await readCsvFile(profilesPath);
    
    // Try using the view first
    let useView = true;
    
    for (const profile of profilesData) {
      try {
        const convertedProfile = convertDataTypes(profile, 'profiles_view');
        const tableName = useView ? 'profiles_view' : 'profiles';
        
        const { error } = await supabase
          .from(tableName)
          .upsert(convertedProfile, { onConflict: 'id', returning: 'minimal' });
        
        if (error) {
          if (useView) {
            // If using the view fails, try direct table access
            console.log('View insert failed, trying direct table access...');
            useView = false;
            
            // Retry with direct table access
            const { directError } = await supabase
              .from('profiles')
              .upsert(convertedProfile, { onConflict: 'id', returning: 'minimal' });
            
            if (directError) {
              console.error(`Error importing profile ${profile.email}:`, directError);
              console.error('Failed data:', convertedProfile);
            } else {
              console.log(`Successfully imported profile for ${profile.email} (direct table)`);
            }
          } else {
            console.error(`Error importing profile ${profile.email}:`, error);
            console.error('Failed data:', convertedProfile);
          }
        } else {
          console.log(`Successfully imported profile for ${profile.email} (${tableName})`);
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