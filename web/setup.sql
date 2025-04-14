-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean reset)
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS profiles;

-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    department TEXT,
    "position" TEXT,
    hire_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status TEXT CHECK (status IN ('present', 'late', 'absent', 'leave')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, date)
);

-- Create leave requests table
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT CHECK (type IN ('annual', 'sick', 'personal', 'unpaid')),
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity log table
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints (after tables are created)
ALTER TABLE profiles ADD FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Create a function to check if user is admin to avoid circular references
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simple profiles policies
CREATE POLICY "Users can view own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

-- Admin policies for profiles table - Use direct auth check to avoid circular references
CREATE POLICY "Admins can view all profiles" ON profiles 
    FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles 
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can insert profiles" ON profiles 
    FOR INSERT WITH CHECK (is_admin());

-- Create simple attendance policies
CREATE POLICY "View own attendance" ON attendance 
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins view all attendance" ON attendance 
    FOR SELECT USING (is_admin());

CREATE POLICY "Insert own attendance" ON attendance 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Update own attendance" ON attendance 
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins update any attendance" ON attendance 
    FOR UPDATE USING (is_admin());

-- Create simple leave request policies
CREATE POLICY "View own leave requests" ON leave_requests 
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins view all leave requests" ON leave_requests 
    FOR SELECT USING (is_admin());

CREATE POLICY "Insert own leave requests" ON leave_requests 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Update own pending requests" ON leave_requests 
    FOR UPDATE USING (
        auth.uid()::text = user_id::text 
        AND status = 'pending'
    );

CREATE POLICY "Admins update any leave request" ON leave_requests 
    FOR UPDATE USING (is_admin());

-- Create simple activity log policies
CREATE POLICY "View own activity logs" ON activity_log 
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins view all activity logs" ON activity_log 
    FOR SELECT USING (is_admin());

CREATE POLICY "Insert own activity logs" ON activity_log 
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Create timestamp update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers
CREATE TRIGGER update_profiles_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_timestamp
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_timestamp
BEFORE UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 