document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Check if Supabase client is properly initialized
    if (!window.supabaseClient) {
        console.error('Supabase client not initialized properly');
        alert('Authentication system failed to load. Please refresh the page and try again.');
        return;
    }
    
    // Clear any existing session data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('supabase.auth.token');
    
    // Check if the database is properly set up
    checkDatabaseSetup();
    
    // Log Supabase configuration values (don't include full key in production)
    console.log('Supabase client available:', !!window.supabaseClient);
    
    // DOM elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const toastNotification = document.getElementById('toastNotification');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    // Initialize Bootstrap toast
    const toast = new bootstrap.Toast(toastNotification);
    
    // Toggle password visibility
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    });
    
    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading overlay
        loadingOverlay.style.display = 'flex';
        
        try {
            // Clear any existing session data before login
            localStorage.removeItem('currentUser');
            localStorage.removeItem('supabase.auth.token');
            
            // Attempt to sign in with email and password
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value,
                options: {
                    shouldCreateUser: false
                }
            });
            
            if (error) {
                throw error;
            }
            
            if (!data.session) {
                throw new Error('No session data received');
            }
            
            // Get user profile data to determine role
            const { data: profileData, error: profileError } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
                
            if (profileError) {
                console.warn('Could not fetch user profile:', profileError);
            } else if (profileData) {
                // Add role from profile to user metadata if it exists
                data.user.user_metadata = {
                    ...data.user.user_metadata,
                    role: profileData.role || 'employee',
                    full_name: profileData.full_name
                };
            }
            
            // Store user data in local storage
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            // Try to ensure sync tables exist
            await ensureSyncTablesExist();
            
            // Log login activity
            try {
                await window.supabaseClient
                    .from('activity_log')
                    .insert({
                        user_id: data.user.id,
                        action: 'login',
                        entity_type: 'auth',
                        created_at: new Date().toISOString()
                    });
            } catch (logError) {
                console.warn("Non-critical error logging login activity:", logError);
            }
            
            // Redirect based on user role
            const userRole = data.user.user_metadata?.role || profileData?.role || 'employee';
            
            if (userRole === 'company') {
                window.location.href = 'index.html'; // Company dashboard
            } else {
                // Show access denied message for employees
                alert('Employee access to web portal is restricted. Please use the mobile app.');
                
                // Clear credentials and session
                localStorage.removeItem('currentUser');
                localStorage.removeItem('supabase.auth.token');
                await window.supabaseClient.auth.signOut();
                loadingOverlay.style.display = 'none';
            }
        } catch (error) {
            console.error('Login process error:', error);
            
            // Hide loading overlay
            loadingOverlay.style.display = 'none';
            
            // Clear any stored session data on error
            localStorage.removeItem('currentUser');
            localStorage.removeItem('supabase.auth.token');
            
            // Show error notification
            alert(error.message || 'Failed to login. Please check your credentials.');
            
            // Clear password field
            passwordInput.value = '';
        }
    });
    
    // Function to show toast messages
    function showToast(title, message, type = 'info') {
        console.log(`Showing toast: ${type} - ${title} - ${message}`);
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Remove any existing color classes
        toastNotification.classList.remove('bg-success', 'bg-danger', 'bg-info');
        
        // Add appropriate color class
        if (type === 'success') {
            toastNotification.classList.add('bg-success', 'text-white');
        } else if (type === 'error') {
            toastNotification.classList.add('bg-danger', 'text-white');
        } else {
            toastNotification.classList.add('bg-info', 'text-white');
        }
        
        // Show the toast
        toast.show();
    }
});

async function ensureSyncTablesExist() {
    try {
        const { error } = await window.supabaseClient.rpc('ensure_sync_tables_exist');
        if (error) {
            console.warn('Error ensuring sync tables exist:', error);
        }
    } catch (error) {
        console.warn('Error in ensureSyncTablesExist:', error);
    }
}

async function checkDatabaseSetup() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id')
            .limit(1);
            
        if (error) {
            console.error('Database setup check failed:', error);
            alert('Database is not properly set up. Please contact your administrator.');
        }
    } catch (error) {
        console.error('Error checking database setup:', error);
        alert('Error checking database setup. Please contact your administrator.');
    }
} 