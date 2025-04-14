# Database Schema Migrations

This directory contains SQL migrations for updating the application's database schema.

## Current Migrations

### 1. add_registration_fields.sql

This migration adds all necessary fields to support the full registration form in the web application:

- `first_name`: Employee's first name
- `last_name`: Employee's last name
- `middle_initial`: Employee's middle initial
- `address`: Employee's address
- `phone_number`: Employee's contact number
- `salary`: Employee's salary
- `position`: Employee's position
- `department`: Employee's department
- `custom_id`: Custom employee ID
- `archived`: Flag for archiving employees instead of deleting them

The migration also:
- Adds appropriate indexes for performance optimization
- Updates the RLS (Row Level Security) policies for proper access control
- Fixes the full_name generation for existing records

## Running Migrations

### Option 1: Using the run_migrations.js Script

The easiest way to run the migrations is to use the provided script:

```bash
# Install dependencies if needed
npm install @supabase/supabase-js

# Run the migration script
node run_migrations.js
```

### Option 2: Running SQL Directly in Supabase

1. Log in to your Supabase dashboard
2. Go to SQL Editor
3. Open the migration file you want to run
4. Copy the SQL content
5. Paste it into the Supabase SQL Editor
6. Click "Run" to execute the migration

## Schema Validation

After running a migration, you can verify the schema changes by:

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY column_name;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
ORDER BY indexname;

-- Check policies
SELECT * 
FROM pg_policies 
WHERE tablename = 'profiles';
```

## Schema Documentation

### Profiles Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, references auth.users id |
| email | TEXT | User's email address |
| first_name | TEXT | User's first name |
| last_name | TEXT | User's last name |
| middle_initial | TEXT | User's middle initial |
| full_name | TEXT | Generated from first_name, middle_initial, and last_name |
| address | TEXT | User's address |
| phone_number | TEXT | User's contact number |
| salary | NUMERIC | User's salary |
| position | TEXT | User's job position |
| department | TEXT | User's department |
| custom_id | TEXT | Custom employee ID |
| role | TEXT | User role (employee, company, admin) |
| company_id | UUID | References the company user ID |
| archived | BOOLEAN | Whether the user is archived |
| created_at | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | Last update timestamp | 