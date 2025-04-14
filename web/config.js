// AttendEase - Supabase Configuration
// Replace these values with your own Supabase project credentials

// For security in production, these values should be loaded from environment variables
// or a secure configuration system, not hard-coded in the source
const SUPABASE_CONFIG = {
    // Your Supabase URL
    SUPABASE_URL: 'https://ygoscobzvzogoqzzctob.supabase.co',
    
    // Your Supabase anon/public key
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs'
};

// Make configuration and client available globally
(function() {
    // Check if Supabase is loaded
    if (typeof supabase === 'undefined') {
        console.error('Supabase JS library not loaded. Make sure to include the Supabase script before config.js');
        
        // Add an alert for users
        window.addEventListener('DOMContentLoaded', () => {
            alert('Error: Required libraries not loaded. Please check your internet connection and reload the page.');
        });
        return;
    }
    
    // Set global variables
    window.SUPABASE_URL = SUPABASE_CONFIG.SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_CONFIG.SUPABASE_ANON_KEY;
    
    // Initialize Supabase client and make it globally available
    try {
        // Create the client
        window.supabaseClient = supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_KEY
        );
        
        // Test connection with a simple RPC call
        window.supabaseClient.rpc('get_server_time').then(response => {
            if (response.error) {
                console.warn('Supabase connection test failed:', response.error);
                
                // Only show alert if it's a server connection error (not CORS or other issues)
                if (response.error.code === 'PGRST301') {
                    window.addEventListener('DOMContentLoaded', () => {
                        alert('Cannot connect to the database. Please check your internet connection and try again.');
                    });
                }
            } else {
                console.log('Supabase connection established successfully');
            }
        }).catch(err => {
            console.error('Supabase connection test error:', err);
        });
        
        console.log('Supabase client initialized in config.js');
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        
        // Add an alert for users
        window.addEventListener('DOMContentLoaded', () => {
            alert('Error initializing database connection. Please check your internet connection and reload the page.');
        });
    }
})();

console.log('Supabase configuration loaded');

// DO NOT modify below this line
// Export the configuration for use in the app
(function() {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
})();

// Note: In a production environment, you should use environment variables
// to store these values and not include them directly in client-side code 