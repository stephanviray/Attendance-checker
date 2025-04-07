// AttendEase - Database Setup Script
console.log("Loading database setup script...");

// Get Supabase credentials from the global scope if available
const SUPABASE_URL = window.SUPABASE_URL || 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Store references to DOM elements
let setupStatus;
let setupProgress;
let setupLog;
let setupButton;

// Initialize the setup UI
document.addEventListener('DOMContentLoaded', function() {
    console.log("Setup page loaded");
    
    // Get references to UI elements
    setupStatus = document.getElementById('setupStatus');
    setupProgress = document.getElementById('setupProgress');
    setupLog = document.getElementById('setupLog');
    setupButton = document.getElementById('runSetupButton');
    
    // Add event listener to setup button
    if (setupButton) {
        setupButton.addEventListener('click', runDatabaseSetup);
    }
    
    // Check if we should auto-run setup (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autorun') === 'true') {
        console.log("Auto-running setup based on URL parameter");
        setTimeout(runDatabaseSetup, 1000); // Delay slightly to allow UI to render
    }
});

// Main setup function
async function runDatabaseSetup() {
    console.log("Running database setup");
    
    // Update UI state
    if (setupButton) setupButton.disabled = true;
    if (setupStatus) setupStatus.textContent = "Setting up database...";
    if (setupProgress) {
        setupProgress.style.width = "5%";
        setupProgress.setAttribute('aria-valuenow', 5);
    }
    
    try {
        // Step 1: Create the SQL execution function if it doesn't exist
        addLogMessage("Step 1: Creating SQL execution function...");
        await createSqlFunction();
        updateProgress(20);
        
        // Step 2: Create profiles table
        addLogMessage("Step 2: Creating profiles table...");
        await createProfilesTable();
        updateProgress(40);
        
        // Step 3: Create attendance tables
        addLogMessage("Step 3: Creating attendance tables...");
        await createAttendanceTables();
        updateProgress(60);
        
        // Step 4: Create activity log table
        addLogMessage("Step 4: Creating activity log table...");
        await createActivityLogTable();
        updateProgress(80);
        
        // Step 5: Create mobile sync tables
        addLogMessage("Step 5: Creating mobile sync tables...");
        await createSyncTables();
        updateProgress(100);
        
        // Setup complete
        addLogMessage("✅ Database setup completed successfully!");
        if (setupStatus) setupStatus.textContent = "Setup completed successfully!";
        if (setupButton) {
            setupButton.textContent = "Setup Complete";
            setupButton.classList.remove("btn-primary");
            setupButton.classList.add("btn-success");
        }
        
    } catch (error) {
        console.error("Setup failed:", error);
        addLogMessage(`❌ Error: ${error.message || "Unknown error"}`);
        if (setupStatus) setupStatus.textContent = "Setup failed";
        if (setupProgress) setupProgress.classList.replace("bg-primary", "bg-danger");
        if (setupButton) {
            setupButton.disabled = false;
            setupButton.textContent = "Retry Setup";
        }
    }
}

// Helper function to add a message to the setup log
function addLogMessage(message) {
    console.log(message);
    if (setupLog) {
        const line = document.createElement('div');
        line.innerHTML = message;
        setupLog.appendChild(line);
        setupLog.scrollTop = setupLog.scrollHeight;
    }
}

// Helper function to update the progress bar
function updateProgress(percent) {
    if (setupProgress) {
        setupProgress.style.width = `${percent}%`;
        setupProgress.setAttribute('aria-valuenow', percent);
    }
}

// Step 1: Create SQL execution function
async function createSqlFunction() {
    const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_command text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        EXECUTE sql_command;
        RETURN json_build_object('success', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'errcode', SQLSTATE
        );
    END;
    $$;
    
    CREATE OR REPLACE FUNCTION exec_sql_exists()
    RETURNS boolean
    LANGUAGE plpgsql
    AS $$
    BEGIN
        RETURN TRUE;
    END;
    $$;
    `;
    
    // First try to call exec_sql_exists to see if the function already exists
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_exists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({})
        });
        
        if (response.ok) {
            addLogMessage("SQL execution function already exists, skipping creation.");
            return;
        }
    } catch (error) {
        // Function likely doesn't exist, proceed with creation
        console.log("SQL execution function doesn't exist, creating it now.");
    }
    
    // Create the function using the REST API and SQL directly
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                query: createFunctionSQL
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create SQL execution function: ${errorText}`);
        }
        
        addLogMessage("SQL execution function created successfully.");
    } catch (error) {
        // Try an alternative approach using direct SQL endpoint
        try {
            addLogMessage("Trying alternative approach for function creation...");
            
            const response = await fetch(`${SUPABASE_URL}/sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({
                    query: createFunctionSQL
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Alternative function creation failed: ${errorText}`);
            }
            
            addLogMessage("SQL execution function created successfully via SQL endpoint.");
        } catch (altError) {
            console.error("All approaches to create function failed:", altError);
            throw new Error("Could not create SQL execution function. Please run the SQL script from the Supabase dashboard SQL editor manually.");
        }
    }
}

// Step 2: Create profiles table
async function createProfilesTable() {
    const createTableSQL = `
    -- Create profiles table if not exists
    CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'employee',
        department TEXT,
        position TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Enable Row Level Security
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Create policies for profiles
    CREATE POLICY IF NOT EXISTS "Profiles are viewable by authenticated users"
        ON public.profiles
        FOR SELECT USING (auth.role() = 'authenticated');
        
    CREATE POLICY IF NOT EXISTS "Users can update their own profiles"
        ON public.profiles
        FOR UPDATE USING (auth.uid() = id);
        
    CREATE POLICY IF NOT EXISTS "Admins can manage all profiles"
        ON public.profiles
        USING (
            auth.uid() IN (
                SELECT id FROM public.profiles WHERE role = 'admin'
            )
        );
    `;
    
    await executeSQL(createTableSQL);
    addLogMessage("Profiles table created successfully.");
}

// Step 3: Create attendance tables
async function createAttendanceTables() {
    const createTableSQL = `
    -- Create attendance table
    CREATE TABLE IF NOT EXISTS public.attendance (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in TIMESTAMP WITH TIME ZONE NOT NULL,
        check_out TIMESTAMP WITH TIME ZONE,
        status TEXT NOT NULL DEFAULT 'present',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Create index on attendance table
    CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);
    
    -- Enable Row Level Security
    ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY IF NOT EXISTS "Users can view their own attendance"
        ON public.attendance
        FOR SELECT USING (auth.uid() = user_id);
        
    CREATE POLICY IF NOT EXISTS "Users can insert their own attendance"
        ON public.attendance
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
    CREATE POLICY IF NOT EXISTS "Admins can view all attendance"
        ON public.attendance
        FOR SELECT USING (
            auth.uid() IN (
                SELECT id FROM public.profiles WHERE role = 'admin'
            )
        );
    
    -- Create leave requests table
    CREATE TABLE IF NOT EXISTS public.leave_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        leave_type TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Create index on leave requests table
    CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
    
    -- Enable Row Level Security
    ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY IF NOT EXISTS "Users can view their own leave requests"
        ON public.leave_requests
        FOR SELECT USING (auth.uid() = user_id);
        
    CREATE POLICY IF NOT EXISTS "Users can insert their own leave requests"
        ON public.leave_requests
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
    CREATE POLICY IF NOT EXISTS "Admins can manage all leave requests"
        ON public.leave_requests
        USING (
            auth.uid() IN (
                SELECT id FROM public.profiles WHERE role = 'admin'
            )
        );
    `;
    
    await executeSQL(createTableSQL);
    addLogMessage("Attendance tables created successfully.");
}

// Step 4: Create activity log table
async function createActivityLogTable() {
    const createTableSQL = `
    -- Create activity log table for tracking actions
    CREATE TABLE IF NOT EXISTS public.activity_log (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Create index on activity log table
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);
    
    -- Enable Row Level Security
    ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY IF NOT EXISTS "Users can view their own activity logs"
        ON public.activity_log
        FOR SELECT USING (auth.uid() = user_id);
        
    CREATE POLICY IF NOT EXISTS "Admins can view all activity logs"
        ON public.activity_log
        FOR SELECT USING (
            auth.uid() IN (
                SELECT id FROM public.profiles WHERE role = 'admin'
            )
        );
        
    CREATE POLICY IF NOT EXISTS "Users can insert activity logs"
        ON public.activity_log
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    `;
    
    await executeSQL(createTableSQL);
    addLogMessage("Activity log table created successfully.");
}

// Step 5: Create mobile sync tables
async function createSyncTables() {
    const createTableSQL = `
    -- Create shared profile data table
    CREATE TABLE IF NOT EXISTS public.shared_profile_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        profile_data JSONB NOT NULL,
        last_synced_from VARCHAR(50) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT unique_user_profile UNIQUE (user_id)
    );
    
    -- Enable RLS
    ALTER TABLE public.shared_profile_data ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for select
    CREATE POLICY IF NOT EXISTS "Users can view their own shared profile data"
        ON public.shared_profile_data
        FOR SELECT 
        USING (auth.uid() = user_id);
    
    -- Create policy for insert/update
    CREATE POLICY IF NOT EXISTS "Users can update their own shared profile data"
        ON public.shared_profile_data
        FOR UPDATE
        USING (auth.uid() = user_id);
    
    -- Create policy for insert
    CREATE POLICY IF NOT EXISTS "Users can insert their own shared profile data"
        ON public.shared_profile_data
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    
    -- Create token table for mobile-web sync
    CREATE TABLE IF NOT EXISTS public.sync_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        CONSTRAINT unique_user_token UNIQUE (user_id, token)
    );
    
    -- Enable RLS
    ALTER TABLE public.sync_tokens ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for select
    CREATE POLICY IF NOT EXISTS "Users can view their own sync tokens"
        ON public.sync_tokens
        FOR SELECT
        USING (auth.uid() = user_id);
    
    -- Create policy for insert/update
    CREATE POLICY IF NOT EXISTS "Users can insert their own sync tokens"
        ON public.sync_tokens
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    `;
    
    await executeSQL(createTableSQL);
    addLogMessage("Mobile sync tables created successfully.");
}

// Helper function to execute SQL via the REST API
async function executeSQL(sqlCommand) {
    try {
        // Try to use the exec_sql function if it exists
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                sql_command: sqlCommand
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SQL execution failed: ${errorText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error executing SQL:", error);
        
        // Try direct SQL execution as fallback
        addLogMessage("Attempting direct SQL execution as fallback...");
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                query: sqlCommand
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Direct SQL execution failed: ${errorText}`);
        }
        
        return { success: true };
    }
} 