# Sample Data for Attendance Checker

This directory contains sample CSV data files for testing and development purposes. The data is structured to match the schema used in the application's database.

## Files Included

- `samples/profiles_sample.csv` - Sample employee profile data
- `samples/attendance_sample.csv` - Sample attendance records
- `samples/leave_requests_sample.csv` - Sample leave requests

## Importing the Sample Data

### Handling Foreign Key Constraints

The profiles table in this application has a foreign key constraint to the auth.users table. This means before importing profiles, corresponding users must exist in the auth.users table.

There are three approaches to handle this:

#### Approach 1: Fix Schema (Recommended for Development)

The easiest approach for local development is to modify the database schema to either remove or modify the foreign key constraint:

```bash
npm run fix-schema-and-import
```

This script will:
1. Apply SQL modifications to the database schema to handle foreign key constraints
2. Create a view and trigger that allows inserting profiles without strict foreign key checks
3. Import the sample data using the modified schema

#### Approach 2: Create Auth Users First

```bash
# First create auth users
npm run create-auth-users

# Then import the sample data
npm run import-sample-data
```

The `create-auth-users` script will:
1. Generate SQL to insert users into the auth.users table
2. Attempt to execute the SQL via the `exec_sql` RPC function
3. If that fails, save the SQL to a file that you can run manually

#### Approach 3: Use Import Script with Auto-Creation

The `import-sample-data` script includes logic to:
1. Check for foreign key constraints
2. Create auth users if needed (via Supabase Admin API)
3. Insert profile data with matching IDs

### Schema Fix Details

The schema fix (`fix_schema.sql`) provides several options:

1. **Drop the constraint**: Removes the foreign key constraint completely
2. **Modify the constraint**: Makes it deferrable or with cascading options
3. **Use a view with trigger**: Creates a view and trigger that allow inserting data while bypassing strict foreign key checks

### Steps to Import

1. Make sure you have the required environment variables set:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Choose one of the approaches above and run the appropriate command.

### Troubleshooting

If you encounter foreign key constraint errors:

1. Check the database schema:
   ```
   npm run check-schema
   ```

2. Try the schema fix approach:
   ```
   npm run fix-schema-and-import
   ```

3. If you have direct database access, you can run the SQL in `fix_schema.sql` manually.

## Data Structure

### Profiles
The profiles data includes:
- UUIDs for each user (must match auth.users)
- Personal information (name, email, etc.)
- Position and department details
- Role information (employee, company, admin)

### Attendance
The attendance data includes:
- Check-in and check-out times
- Attendance status (present, late, absent)
- References to employee IDs

### Leave Requests
The leave requests data includes:
- Leave types (annual, sick, personal, unpaid)
- Start and end dates
- Request status (pending, approved, rejected)
- Approval information

## Customizing Sample Data

Feel free to modify the CSV files to add more test data or adjust the existing entries to match your specific testing needs. Just make sure to maintain the same column structure to ensure compatibility with the import script. 