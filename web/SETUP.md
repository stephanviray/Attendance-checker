# AttendEase - Database Setup Guide

## Supabase Setup

1. Create a new Supabase project at https://app.supabase.co/
2. Copy your Supabase URL and Anon Key from the API settings page
3. Update the `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants in `app.js` with your values

## Database Setup

1. Open the Supabase SQL Editor
2. Paste and run the contents of `setup.sql` to create all necessary tables and security policies
3. Alternatively, you can run each section separately:
   - First create the tables
   - Then set up Row Level Security (RLS) policies

## Authentication Setup

1. In the Supabase Dashboard, go to Authentication → Settings
2. Make sure "Enable email confirmations" is turned OFF for development (or ON if you have email set up)
3. Configure any additional auth providers if needed (Google, GitHub, etc.)

## Local Development

1. Make sure you have the following environment variables in your `.env` file:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

2. Install dependencies (if using npm):
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

## Testing Authentication

1. Use the signup form to create a test admin account
2. Use the login form to verify authentication is working
3. Check the Supabase Auth → Users section to confirm users are being created

## Common Issues

- If you see CORS errors, make sure you've added your app's URL to the allowed origins in Supabase
- If authentication fails, check browser console for specific error messages
- Make sure your RLS policies are correctly configured 