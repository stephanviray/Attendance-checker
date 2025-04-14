// Insert employee profiles script
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (same as in web/app.js)
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The employee profiles to insert
const profiles = [
  {
    id: '70326d88-f159-4fbb-965e-40adf975b499',
    email: 'viraystephan50@gmail.com',
    full_name: 'viraystephan50',
    role: 'employee',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'f5b10b70-7ce0-4f02-9486-edd4490b6f88',
    email: 'stephanviray50@gmail.com',
    full_name: 'stephanviray50',
    role: 'company',
    company_id: 'f5b10b70-7ce0-4f02-9486-edd4490b6f88',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

async function insertProfiles() {
  try {
    console.log('Inserting profiles into Supabase...');
    
    // First, check if the profiles already exist
    const { data: existingProfiles, error: checkError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .in('id', profiles.map(p => p.id));
      
    if (checkError) {
      console.error('Error checking for existing profiles:', checkError);
      return;
    }
    
    console.log('Existing profiles:', existingProfiles);
    
    if (existingProfiles && existingProfiles.length > 0) {
      console.log('Some profiles already exist, updating them...');
      
      // Update existing profiles
      for (const profile of profiles) {
        const exists = existingProfiles.some(p => p.id === profile.id);
        
        if (exists) {
          const { data, error } = await supabase
            .from('profiles')
            .update(profile)
            .eq('id', profile.id);
            
          console.log(`Updated profile ${profile.id}:`, { data, error });
        } else {
          const { data, error } = await supabase
            .from('profiles')
            .insert(profile);
            
          console.log(`Inserted profile ${profile.id}:`, { data, error });
        }
      }
    } else {
      console.log('No existing profiles found, inserting new ones...');
      
      // Insert all profiles
      const { data, error } = await supabase
        .from('profiles')
        .insert(profiles);
        
      console.log('Insert result:', { data, error });
    }
    
    // Verify the profiles were inserted
    const { data: finalProfiles, error: finalError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (finalError) {
      console.error('Error verifying profiles:', finalError);
      return;
    }
    
    console.log('Final profiles in database:', finalProfiles);
    console.log('Done!');
  } catch (error) {
    console.error('Error inserting profiles:', error);
  }
}

// Run the insert function
insertProfiles(); 