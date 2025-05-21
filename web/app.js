// Supabase configuration
const SUPABASE_URL = 'https://ygoscobzvzogoqzzctob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb3Njb2J6dnpvZ29xenpjdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzM4NTgsImV4cCI6MjA1OTQwOTg1OH0.dazuWkd7-4Po6-WSJO-nPtqgdPYmBUtNkzbc5sAU7vs';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Simple debug handler for links
    document.querySelectorAll('a').forEach(link => {
        console.log("Found link:", link.id || "(no id)", link.textContent.trim());
        
        // Add a simple click handler to all links
        link.addEventListener('click', function(e) {
            console.log("Link clicked:", this.id || "(no id)", this.textContent.trim());
            e.preventDefault();
            
            // Handle navigation based on link id
            if (this.id === 'employeesLink' || this.id === 'mobileEmployeesLink') {
                showEmployeesList();
                localStorage.setItem('currentPage', 'employees');
            } else if (this.id === 'attendanceLogsLink' || this.id === 'mobileAttendanceLogsLink') {
                showAttendanceLogs();
                localStorage.setItem('currentPage', 'attendance');
            } else if (this.id === 'logoutBtn' || this.id === 'mobileLogoutBtn') {
                handleLogout();
            }
        });
    });
    
    // Initialize application
    initializeApp();
});

// Helper function to safely get DOM elements
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found in the DOM`);
    }
    return element;
}

// DOM elements - get them safely
const logoutBtn = safeGetElement('logoutBtn');
const mobileLogoutBtn = safeGetElement('mobileLogoutBtn');
const mobileMenuBtn = safeGetElement('mobileMenuBtn');
const mobileMenu = safeGetElement('mobileMenu');
const loadingOverlay = safeGetElement('loadingOverlay');
const toastNotification = safeGetElement('toastNotification');
const toastTitle = safeGetElement('toastTitle');
const toastMessage = safeGetElement('toastMessage');
const toastTime = safeGetElement('toastTime');

// Navigation links
const employeesLink = safeGetElement('employeesLink');
const attendanceLogsLink = safeGetElement('attendanceLogsLink');
const mobileEmployeesLink = safeGetElement('mobileEmployeesLink');
const mobileAttendanceLogsLink = safeGetElement('mobileAttendanceLogsLink');

// Initialize Bootstrap toast
let toast;
if (toastNotification) {
    toast = new bootstrap.Toast(toastNotification);
} else {
    console.warn("Toast notification element not found");
}

// Current user data
let currentUser = null;
let userId = null;

// Check and refresh the Supabase session if needed
async function ensureValidSession() {
    console.log("Checking Supabase session validity");
    
    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error("Error getting current session:", sessionError);
            return false;
        }
        
        if (!session) {
            console.warn("No active session found");
            return false;
        }
        
        // Check if session has expired or is about to expire
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        const timeToExpiry = expiresAt - now;
        
        // If session is expired or will expire in less than 5 minutes, refresh it
        if (timeToExpiry < 300000) { // 5 minutes in milliseconds
            console.log("Session expired or about to expire, refreshing token");
            
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            
            if (refreshError) {
                console.error("Error refreshing session:", refreshError);
                return false;
            }
            
            if (!refreshData.session) {
                console.warn("Failed to refresh session");
                return false;
            }
            
            console.log("Session refreshed successfully");
        } else {
            console.log("Session is valid until:", expiresAt);
        }
        
        return true;
    } catch (error) {
        console.error("Exception in ensureValidSession:", error);
        return false;
    }
}

// Initialize the app
async function initializeApp() {
    console.log("Initializing application");
    
    // Initialize Bootstrap components
    initializeBootstrapComponents();
    
    // Check and refresh session if needed
    const sessionValid = await ensureValidSession();
    if (!sessionValid) {
        console.warn("No valid session, continuing with local data only");
    }
    
    // Load user data
    await loadUserData();
    
    // Ensure necessary tables exist
    await ensureTablesExist();
    
    // Set up event listeners
    setupEventListeners();
    
    // Direct attachment of event listeners for navigation
    console.log("Setting up direct click handlers");
    document.querySelectorAll('#employeesLink, #mobileEmployeesLink').forEach(link => {
        console.log("Found employee link:", link);
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Employee link clicked directly");
            showEmployeesList();
            // Save current page to localStorage
            localStorage.setItem('currentPage', 'employees');
        });
    });
    
    document.querySelectorAll('#attendanceLogsLink, #mobileAttendanceLogsLink').forEach(link => {
        console.log("Found attendance link:", link);
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Attendance link clicked directly");
            showAttendanceLogs();
            // Save current page to localStorage
            localStorage.setItem('currentPage', 'attendance');
        });
    });
    
    // Forcefully show attendance logs by default, regardless of localStorage
    console.log("Forcefully showing attendance logs as default view");
    localStorage.setItem('currentPage', 'attendance');
    showAttendanceLogs();
    
    // Highlight attendance logs link as active
    if (attendanceLogsLink) attendanceLogsLink.classList.add('active');
    if (mobileAttendanceLogsLink) mobileAttendanceLogsLink.classList.add('active');
}

// Initialize Bootstrap components
function initializeBootstrapComponents() {
    // Initialize toast if element exists
    if (toastNotification) {
        toast = new bootstrap.Toast(toastNotification);
    } else {
        console.warn("Toast notification element not found");
    }
}

// Load user data from localStorage
async function loadUserData() {
    console.log("Loading user data");
    
    try {
        // Get user data from localStorage
        const userDataStr = localStorage.getItem('currentUser');
        if (!userDataStr) {
            console.error("No user data found in localStorage");
            window.location.href = 'login.html';
            return;
        }
        
        // Parse the user data
        try {
            currentUser = JSON.parse(userDataStr);
        } catch (parseError) {
            console.error("Error parsing user data:", parseError);
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            console.error("Invalid user data format");
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
            return;
        }
        
        userId = currentUser.id;
        console.log("User data loaded from localStorage:", currentUser);
        
        // Update UI with data from localStorage first
        updateUIWithUserData(currentUser);
        
        // Check connection to Supabase
        try {
            console.log("Checking Supabase connection");
            const { data: connectionResult, error: connectionError } = await supabaseClient.rpc('get_server_time');
            
            if (connectionError) {
                console.error("Cannot connect to Supabase:", connectionError);
                // Continue with localStorage data
                return;
            }
            
            console.log("Supabase connection successful, timestamp:", connectionResult);
        } catch (connectionError) {
            console.error("Exception connecting to Supabase:", connectionError);
            // Continue with localStorage data
            return;
        }
        
        // Try to get user profile from database
        try {
            console.log("Fetching user profile");
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            
            if (error) {
                console.warn("Error fetching profile:", error);
                // Continue with localStorage data
            } else if (profile) {
                console.log("Profile found:", profile);
                
                // Update UI with profile data
                updateUIWithUserData(profile);
                
                // Update localStorage with the latest profile data
                currentUser = {...currentUser, ...profile};
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                console.log("No profile found, attempting to create one");
                
                // Try to create a profile
                try {
                    const { error: createError } = await supabaseClient
                    .from('profiles')
                    .insert({
                        id: userId,
                        email: currentUser.email,
                        role: 'company', // Default to company role
                        full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0] || 'User',
                        created_at: new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long', 
                            day: 'numeric'
                        }), // Format date as string: e.g., "May 14, 2025"
                        updated_at: new Date().toISOString()
                    });

                    if (createError) {
                        console.warn("Could not create profile:", createError);
                        // Continue with localStorage data
                    } else {
                        console.log("Successfully created profile");
                        
                        // Fetch the newly created profile
                        const { data: newProfile } = await supabaseClient
                            .from('profiles')
                            .select('*')
                            .eq('id', userId)
                            .maybeSingle();
                        
                        if (newProfile) {
                            console.log("Fetched new profile:", newProfile);
                            
                            // Update UI with profile data
                            updateUIWithUserData(newProfile);
                            
                            // Update localStorage with the latest profile data
                            currentUser = {...currentUser, ...newProfile};
                            localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        }
                    }
                } catch (createError) {
                    console.error("Exception creating profile:", createError);
                    // Continue with localStorage data
                }
            }
        } catch (profileError) {
            console.error("Exception fetching user profile:", profileError);
            // Continue with localStorage data
        }
    } catch (err) {
        console.error("Error in loadUserData function:", err);
        // Continue with localStorage data if available
    }
}

// Helper function to update UI with user data
function updateUIWithUserData(userData) {
    try {
        // Update user name elements
        const userNameElements = [
            document.getElementById('currentUserName'),
            document.getElementById('userFullName')
        ].filter(Boolean);
        
        if (userNameElements.length > 0) {
            const displayName = userData.full_name || userData.user_metadata?.full_name || userData.email || 'User';
            userNameElements.forEach(el => el.textContent = displayName);
        }
    } catch (err) {
        console.error("Error updating UI with user data:", err);
    }
}

// Handle logout
function handleLogout() {
    console.log("Logging out user");
    
    // Clear local storage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('supabase.auth.token');
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// Show/hide loading overlay
function showLoading(show) {
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.remove('d-none');
        } else {
            loadingOverlay.classList.add('d-none');
        }
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    if (!toast) return;
    
    // Set toast content
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;
    if (toastTime) toastTime.textContent = new Date().toLocaleTimeString();
    
    // Set toast type
    const toastEl = document.getElementById('toastNotification');
    if (toastEl) {
        toastEl.className = 'toast';
        toastEl.classList.add(`toast-${type}`);
    }
    
    // Show toast
    toast.show();
}

// Set up event listeners
function setupEventListeners() {
    console.log("Setting up event listeners");
    
    // Mobile menu toggle
    if (mobileMenuBtn && mobileMenu) {
        console.log("Setting up mobile menu toggle");
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('d-none');
        });
    }
    
    // Logout buttons
    if (logoutBtn) {
        console.log("Setting up logout button");
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (mobileLogoutBtn) {
        console.log("Setting up mobile logout button");
        mobileLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // Navigation Links - Desktop
    if (attendanceLogsLink) {
        console.log("Setting up attendance logs link");
        attendanceLogsLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Attendance logs link clicked");
            showAttendanceLogs();
            localStorage.setItem('currentPage', 'attendance');
        });
    } else {
        console.warn("Attendance logs link not found");
    }
    
    if (employeesLink) {
        console.log("Setting up employees link");
        employeesLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Employees link clicked");
            showEmployeesList();
            localStorage.setItem('currentPage', 'employees');
        });
    } else {
        console.warn("Employees link not found");
    }
    
    // Navigation Links - Mobile
    if (mobileAttendanceLogsLink) {
        console.log("Setting up mobile attendance logs link");
        mobileAttendanceLogsLink.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMenu.classList.add('d-none');
            console.log("Mobile attendance logs link clicked");
            showAttendanceLogs();
            localStorage.setItem('currentPage', 'attendance');
        });
    } else {
        console.warn("Mobile attendance logs link not found");
    }
    
    if (mobileEmployeesLink) {
        console.log("Setting up mobile employees link");
        mobileEmployeesLink.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMenu.classList.add('d-none');
            console.log("Mobile employees link clicked");
            showEmployeesList();
            localStorage.setItem('currentPage', 'employees');
        });
    } else {
        console.warn("Mobile employees link not found");
    }
}

// Show Employees List
function showEmployeesList() {
    console.log("Showing Employees List");
    
    // Update active state in navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (employeesLink) employeesLink.classList.add('active');
    if (mobileEmployeesLink) mobileEmployeesLink.classList.add('active');
    
    // Get content area
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) {
        console.error("Content area not found");
        return;
    }
    
    // Load employees list
    loadEmployeesList(contentArea);
}

// Show Attendance Logs
function showAttendanceLogs() {
    console.log("Showing Attendance Logs");
    
    // Update active state in navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (attendanceLogsLink) attendanceLogsLink.classList.add('active');
    if (mobileAttendanceLogsLink) mobileAttendanceLogsLink.classList.add('active');
    
    // Get content area
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) {
        console.error("Content area not found");
        return;
    }
    
    // Create attendance logs content with table
    const attendanceLogsHTML = `
        <div id="attendanceLogsContent">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 class="mb-0">Attendance Logs</h1>
                    <p class="text-muted mb-0">Track employee attendance records</p>
                </div>
                <div class="d-flex gap-2 attendance-toolbar">
                    <input type="text" class="form-control form-control-sm" id="attendanceSearch" placeholder="Search logs...">
                    <div class="input-group">
                        <input type="date" class="form-control form-control-sm" id="attendanceDatePicker">
                        <button class="btn btn-outline-secondary btn-sm" type="button" id="clearDateBtn">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-outline-secondary btn-sm active" id="filterAll">All</button>
                        <button class="btn btn-outline-warning btn-sm" id="filterLate">Late</button>
                        <button class="btn btn-outline-danger btn-sm" id="filterAbsent">Absent</button>
                    </div>
                    <button class="btn btn-primary btn-sm" id="refreshAttendanceBtn">
                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0">Attendance Records</h5>
                </div>
                <div class="list-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Employee ID</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Date</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="attendanceList">
                                <tr>
                                    <td colspan="7" class="text-center py-4">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2">Loading attendance records...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Set content
    contentArea.innerHTML = attendanceLogsHTML;
    
    // Add event listeners
    const searchInput = document.getElementById('attendanceSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterAttendanceLogs);
    }
    
    // Setup date picker
    setupDatePicker();
    
    // Setup filter buttons
    setupFilterButtons();
    
    // Load attendance data
    fetchAttendanceLogs();
}

// Fetch attendance logs
async function fetchAttendanceLogs() {
    console.log('Fetching attendance logs');

    try {
        // Show loading state
        const attendanceList = document.getElementById('attendanceList');
        if (!attendanceList) {
            console.error('Attendance list element not found');
            return;
        }

        attendanceList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading attendance records...</p>
                </td>
            </tr>
        `;

        // Get current user's company_id
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.id) {
            console.error('No user data found in localStorage');
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Error: No user data found
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Get the selected date from the date picker
        const datePicker = document.getElementById('attendanceDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;

        // Calculate date range based on selected date
        let startDate, endDate;

        if (selectedDate) {
            startDate = new Date(selectedDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(selectedDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Default to today if no date selected
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        }

        // Prevent showing future dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate > today) {
            endDate = new Date(today); // Only show up to today
        }

        // Determine if we should mark absentees (only after 6 PM on that day or if date is in the past)
        const now = new Date();
        let shouldMarkAbsent = false;
        if (selectedDate) {
            const sixPm = new Date(selectedDate);
            sixPm.setHours(18, 0, 0, 0);
            shouldMarkAbsent = now >= sixPm;
        } else {
            // If no date selected, default to today and check if now >= 6 PM today
            const sixPm = new Date();
            sixPm.setHours(18, 0, 0, 0);
            shouldMarkAbsent = now >= sixPm;
        }

        // First, get all active employees
        const { data: allEmployees, error: employeesError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, department, custom_id')
            .eq('role', 'employee')
            .eq('archived', false)
            .eq('company_id', currentUser.id);

        if (employeesError) throw employeesError;

        // Then get attendance records for the date range
        const { data: attendanceRecords, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select(`
                id,
                employee_id,
                check_in,
                check_out,
                status,
                profiles!attendance_employee_id_fkey (
                    id,
                    full_name,
                    department,
                    custom_id,
                    archived
                )
            `)
            .gte('check_in', startDate.toISOString())
            .lte('check_in', endDate.toISOString())
            .eq('recorded_by', currentUser.id);

        if (attendanceError) throw attendanceError;

        // Create a set of employees who have checked in
        const checkedInEmployees = new Set(attendanceRecords.map(record => record.employee_id));

        // Create records for absent employees ONLY if after 6 PM or date in past
        let absentEmployees = [];
        if (shouldMarkAbsent) {
            // Check if selected date is a weekend
            const isWeekendDay = isWeekend(startDate);
            
            // Only mark absences for weekdays
            if (!isWeekendDay) {
                absentEmployees = allEmployees
                    .filter(emp => !checkedInEmployees.has(emp.id))
                    .map(emp => ({
                        profiles: {
                            id: emp.id,
                            full_name: emp.full_name,
                            department: emp.department,
                            custom_id: emp.custom_id,
                            archived: false
                        },
                        check_in: startDate.toISOString(),
                        check_out: null,
                        status: 'absent',
                        employee_id: emp.id
                    }));
            }
        }

        // Combine attendance records with absent records
        const allRecords = [...attendanceRecords, ...absentEmployees];

        // Filter out archived employees
        const activeRecords = allRecords.filter(record =>
            record.profiles && !record.profiles.archived
        );

        if (!activeRecords || activeRecords.length === 0) {
            // Check if the selected date is weekend
            const isWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;
            
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            ${isWeekend ? 'No Office on Weekends.' : 'No attendance records found for the selected period.'}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Process and display attendance records
        const attendanceHTML = activeRecords.map(record => {
            const checkInDate = new Date(record.check_in);
            const checkOutDate = record.check_out ? new Date(record.check_out) : null;

            // Format times
            const checkInTime = record.status === 'absent' ? '-' : checkInDate.toLocaleTimeString();
            const checkOutTime = checkOutDate ? checkOutDate.toLocaleTimeString() : '-';

            // Determine status (absent, on-time, late, weekend)
            const isWeekendDay = checkInDate.getDay() === 0 || checkInDate.getDay() === 6;
            let status = isWeekendDay ? 'weekend' : 
                record.status === 'absent' ? 'absent' : 
                (() => {
                    if (checkInDate.getHours() > 9 ||
                        (checkInDate.getHours() === 9 && checkInDate.getMinutes() > 0)) {
                        return 'late';
                    }
                    return 'on-time';
                })();

            // Initialize lateness text
            let latenessText = '';
            
            // Show "No office on weekends" for both Saturday and Sunday
            if (isWeekendDay) {
                latenessText = 'No Office on Weekends.';
            } else if (status === 'late') {
                const expectedTime = new Date(checkInDate);
                expectedTime.setHours(9, 0, 0, 0);
                const lateBy = Math.floor((checkInDate - expectedTime) / (1000 * 60));
                const lateHours = Math.floor(lateBy / 60);
                const lateMinutes = lateBy % 60;
                latenessText = lateHours > 0 ?
                    `Late by ${lateHours}h ${lateMinutes}m` :
                    `Late by ${lateMinutes}m`;
            }

            // Determine badge and styling like in the filter view
            let badgeClass, iconClass, statusText, rowClass;
            
            if (isWeekendDay) {
                statusText = 'No Office';
                rowClass = '';
                badgeClass = 'bg-secondary';
                iconClass = 'bi-calendar-x';
            } else if (status === 'absent') {
                statusText = 'Absent';
                rowClass = 'table-danger';
                badgeClass = 'bg-danger';
                iconClass = 'bi-x-circle-fill';
            } else if (status === 'late') {
                statusText = `Late (${latenessText})`;
                rowClass = 'table-warning';
                badgeClass = 'bg-warning';
                iconClass = 'bi-clock-fill';
            } else {
                statusText = 'On Time';
                rowClass = 'table-success';
                badgeClass = 'bg-success';
                iconClass = 'bi-check-circle-fill';
            }
            
            return `
                <tr class="${rowClass}" data-status="${status}">
                    <td>${record.profiles.custom_id || record.employee_id}</td>
                    <td>${record.profiles.full_name || 'Unknown'}</td>
                    <td>${record.profiles.department || 'General'}</td>
                    <td>${checkInDate.toLocaleDateString()}</td>
                    <td>${checkInTime}</td>
                    <td>${checkOutTime}</td>
                    <td><span class="badge ${badgeClass}"><i class="bi ${iconClass}"></i> ${statusText}</span></td>
                </tr>
            `;
        }).join('');

        attendanceList.innerHTML = attendanceHTML;

        // Setup filter buttons
        setupFilterButtons();

    } catch (error) {
        console.error('Error in fetchAttendanceLogs:', error);
        attendanceList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error: ${error.message}
                    </div>
                </td>
            </tr>
        `;
    }
}

// Filter attendance logs based on search and date filter
// Separate search function for attendance logs that runs after data is loaded
function searchAttendanceLogs() {
    console.log('Searching attendance logs');
    
    // Get search input
    const searchInput = document.getElementById('attendanceSearch');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    console.log('Search term:', searchTerm);
    
    // Get current filter
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const currentFilter = activeFilterBtn ? activeFilterBtn.id.replace('filter', '').toLowerCase() : 'all';
    console.log('Current filter:', currentFilter);
    
    // Get all rows after data has been loaded
    const rows = document.querySelectorAll('#attendanceList tr');
    console.log('Found', rows.length, 'rows to filter');
    
    // Keep track of visible rows
    let visibleCount = 0;
    
    // Apply filtering to each row
    rows.forEach(row => {
        // Skip header rows or rows without data
        if (!row.querySelector('td')) return;
        
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        
        // Get row data 
        const employeeId = cells[0]?.textContent.toLowerCase() || '';
        const name = cells[1]?.textContent.toLowerCase() || '';
        const department = cells[2]?.textContent.toLowerCase() || '';
        const date = cells[3]?.textContent.toLowerCase() || '';
        const checkIn = cells[4]?.textContent.toLowerCase() || '';
        const checkOut = cells[5]?.textContent.toLowerCase() || '';
        
        // Check status (from data attribute)
        const status = row.getAttribute('data-status') || '';
        
        // Match search term
        const matchesSearch = !searchTerm || (
            employeeId.includes(searchTerm) ||
            name.includes(searchTerm) ||
            department.includes(searchTerm) ||
            date.includes(searchTerm) ||
            checkIn.includes(searchTerm) ||
            checkOut.includes(searchTerm)
        );
        
        // Match status filter
        let matchesFilter = true;
        if (currentFilter !== 'all') {
            if (status === 'weekend' || status === 'no-office') {
                matchesFilter = false;
            } else {
                matchesFilter = status === currentFilter;
            }
        }
        
        // Show or hide row
        const shouldShow = matchesSearch && matchesFilter;
        row.style.display = shouldShow ? '' : 'none';
        
        if (shouldShow) visibleCount++;
    });
    
    console.log('Visible rows after filtering:', visibleCount);
    
    // Show 'no results' message if needed
    const noResultsRow = document.getElementById('noResultsRow');
    if (noResultsRow) {
        noResultsRow.style.display = visibleCount === 0 ? '' : 'none';
    } else if (visibleCount === 0) {
        // If no results and no message row exists, create one
        const attendanceList = document.getElementById('attendanceList');
        if (attendanceList) {
            const noResults = document.createElement('tr');
            noResults.id = 'noResultsRow';
            noResults.innerHTML = `
                <td colspan="7" class="text-center p-3">
                    <div class="alert alert-info mb-0">
                        <i class="bi bi-info-circle me-2"></i>
                        No matching records found.
                    </div>
                </td>
            `;
            attendanceList.appendChild(noResults);
        }
    }
}

function filterAttendanceLogs() {
    console.log('Filtering attendance logs');
    
    // Get the date picker value
    const datePicker = document.getElementById('attendanceDatePicker');
    const selectedDate = datePicker ? datePicker.value : null;
    
    if (!selectedDate) {
        showToast('Please select a date first', 'Select a date to view attendance records', 'warning');
        return;
    }
    
    // Show loading spinner
    const attendanceList = document.getElementById('attendanceList');
    attendanceList.innerHTML = `
        <tr><td colspan="7" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading records...</p>
        </td></tr>`;

    // Fetch fresh data
    fetchAttendanceLogs().then(() => {
        // After data is loaded, apply search filtering
        searchAttendanceLogs();
        
        // Add event listener to search input if it doesn't exist yet
        const searchInput = document.getElementById('attendanceSearch');
        if (searchInput && !searchInput._hasSearchListener) {
            searchInput.addEventListener('input', () => {
                searchAttendanceLogs();
            });
            searchInput._hasSearchListener = true;
        }
    });
}

// ... rest of the code remains the same ...

async function displayAllRecords() {
    const attendanceList = document.getElementById('attendanceList');
    attendanceList.innerHTML = `
        <tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading records...</p>
        </td></tr>`;

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.id) throw new Error('No user data found');

        const datePicker = document.getElementById('attendanceDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;

        let startDate = selectedDate ? new Date(selectedDate) : new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);

        // Get all active employees
        const { data: allEmployees, error: employeesError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, department, custom_id')
            .eq('role', 'employee')
            .eq('archived', false)
            .eq('company_id', currentUser.id);
        if (employeesError) throw employeesError;

        // Get attendance records for the day
        const { data: attendanceRecords, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select('employee_id, check_in, check_out')
            .gte('check_in', startDate.toISOString())
            .lte('check_in', endDate.toISOString())
            .eq('recorded_by', currentUser.id);
        if (attendanceError) throw attendanceError;

        // Create map of attendance records
        const attendanceMap = new Map();
        attendanceRecords.forEach(record => {
            attendanceMap.set(record.employee_id, record);
        });

        // Get the search term
        const searchInput = document.getElementById('attendanceSearch');
        const searchTerm = searchInput?.value.toLowerCase().trim() || '';

        // Generate rows for all employees (on_time, late, and absent)
        const rows = allEmployees.map(emp => {
            const record = attendanceMap.get(emp.id);
            const isWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;
            
            // Enhanced search functionality - search across multiple fields like employee list search
            const matchesSearch = !searchTerm || (
                (emp.custom_id && emp.custom_id.toLowerCase().includes(searchTerm)) ||
                (emp.full_name && emp.full_name.toLowerCase().includes(searchTerm)) ||
                (emp.department && emp.department.toLowerCase().includes(searchTerm)) ||
                (emp.position && emp.position.toLowerCase().includes(searchTerm)) ||
                (record && new Date(record.check_in).toLocaleTimeString().toLowerCase().includes(searchTerm))
            );
            
            if (!matchesSearch) {
                return null;
            }
            
            // Status determination
            let status, statusClass, badgeClass, iconClass;
            
            if (isWeekend) {
                status = 'No Office';
                statusClass = '';
                badgeClass = 'bg-secondary';
                iconClass = 'bi-calendar-x';
            } else if (record) {
                const minutesLate = calculateLateness(record.check_in);
                if (minutesLate > 0) {
                    // Calculate lateness text for display
                    const hoursLate = Math.floor(minutesLate / 60);
                    const remainingMinutes = minutesLate % 60;
                    const lateText = hoursLate > 0 ? 
                        `${hoursLate}h ${remainingMinutes}m late` : 
                        `${minutesLate}m late`;
                    
                    status = `Late (${lateText})`;
                    const dataStatus = 'late'; // Use simple status for filtering
                    statusClass = 'table-warning';
                    badgeClass = 'bg-warning';
                    iconClass = 'bi-clock-fill';
                } else {
                    status = 'On Time';
                    statusClass = 'table-success';
                    badgeClass = 'bg-success';
                    iconClass = 'bi-check-circle-fill';
                }
            } else {
                status = 'Absent';
                statusClass = 'table-danger';
                badgeClass = 'bg-danger';
                iconClass = 'bi-x-circle-fill';
            }
            
            return `
                <tr class="${statusClass}" data-status="${isWeekend ? 'weekend' : record ? (status.toLowerCase().includes('late') ? 'late' : 'on_time') : 'absent'}">
                    <td>${emp.custom_id}</td>
                    <td>${emp.full_name}</td>
                    <td>${emp.department || 'General'}</td>
                    <td>${startDate.toLocaleDateString()}</td>
                    <td>${record ? new Date(record.check_in).toLocaleTimeString() : ''}</td>
                    <td>${record && record.check_out ? new Date(record.check_out).toLocaleTimeString() : ''}</td>
                    <td><span class="badge ${badgeClass}"><i class="bi ${iconClass}"></i> ${status}</span></td>
                </tr>
            `;
        }).filter(row => row !== null).join('');

        if (rows.length === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No matching records found.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        attendanceList.innerHTML = rows;

    } catch (err) {
        console.error('Error displaying records:', err);
        attendanceList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error: ${err.message}
                    </div>
                </td>
            </tr>
        `;
    }
}

async function displayLateOnly() {
    const attendanceList = document.getElementById('attendanceList');
    attendanceList.innerHTML = `
        <tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading late records...</p>
        </td></tr>`;

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.id) throw new Error('No user data found');

        const datePicker = document.getElementById('attendanceDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;

        if (!selectedDate) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Please select a date first
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Set up date range
        let startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        // Skip weekends
        if (startDate.getDay() === 0 || startDate.getDay() === 6) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            Selected date is a weekend. No attendance required.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Use separate queries instead of JOIN since there's an ambiguous relationship
        console.log('Fetching late records for date:', selectedDate);
        
        // Get all attendance records for the day
        const { data: attendanceRecords, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select('*')
            .gte('check_in', startDate.toISOString())
            .lte('check_in', endDate.toISOString())
            .eq('recorded_by', currentUser.id);
        
        if (attendanceError) throw attendanceError;
        console.log('Found attendance records:', attendanceRecords?.length || 0);
        
        // Get all employee profiles
        const { data: allProfiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('company_id', currentUser.id);
        
        if (profilesError) throw profilesError;
        console.log('Found employee profiles:', allProfiles?.length || 0);
        
        // Create a lookup map for employee profiles
        const profilesMap = {};
        if (allProfiles) {
            allProfiles.forEach(profile => {
                profilesMap[profile.id] = profile;
            });
        }
        console.log('Created profiles lookup map with', Object.keys(profilesMap).length, 'entries');
        
        if (!attendanceRecords || attendanceRecords.length === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No attendance records found for the selected date.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Now filter to find late employees
        const lateRecords = [];
        
        for (const record of attendanceRecords) {
            const checkInTime = new Date(record.check_in);
            const nineAM = new Date(checkInTime);
            nineAM.setHours(9, 0, 0, 0);
            
            // Get the employee profile for this record
            const profile = profilesMap[record.employee_id];
            const employeeName = profile ? profile.full_name : `Unknown (ID: ${record.employee_id})`;
            
            console.log(`Checking if late: ${employeeName}, Time: ${checkInTime.toLocaleTimeString()}`);
            
            if (checkInTime > nineAM) {
                console.log(`*** LATE: ${employeeName} arrived at ${checkInTime.toLocaleTimeString()}`);
                // Store both the record and the profile for easier access
                lateRecords.push({
                    record: record,
                    profile: profile
                });
            }
        }
        
        console.log(`Found ${lateRecords.length} late records`);
        
        if (lateRecords.length === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle me-2"></i>
                            No late employees for the selected date.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Get search term
        const searchInput = document.getElementById('attendanceSearch');
        const searchTerm = searchInput?.value.toLowerCase().trim() || '';
        console.log('Applying search filter:', searchTerm ? `'${searchTerm}'` : '(none)');
        
        // Generate table rows from the late records
        let rowsHtml = '';
        let matchCount = 0;
        
        for (const item of lateRecords) {
            const record = item.record;
            const profile = item.profile;
            
            // Skip if no profile data
            if (!profile) {
                console.log(`WARNING: No profile data for employee ID ${record.employee_id}`);
                continue;
            }
            
            console.log(`Processing late record for: ${profile.full_name}, ID: ${profile.id}`);
            
            // Apply search filter if provided
            if (searchTerm && 
                !String(profile.custom_id || '').toLowerCase().includes(searchTerm) && 
                !String(profile.full_name || '').toLowerCase().includes(searchTerm) && 
                !String(profile.department || '').toLowerCase().includes(searchTerm)) {
                console.log(`Filtered out by search term: ${searchTerm}`);
                continue;  // Skip if doesn't match search
            }
            
            matchCount++;
            console.log(`Match #${matchCount}: ${profile.full_name}`);
            
            // Calculate lateness
            const checkInTime = new Date(record.check_in);
            const expectedTime = new Date(checkInTime);
            expectedTime.setHours(9, 0, 0, 0);
            const minutesLate = Math.floor((checkInTime - expectedTime) / (1000 * 60));
            const hoursLate = Math.floor(minutesLate / 60);
            const remainingMinutes = minutesLate % 60;
            const lateText = hoursLate > 0 ? 
                `${hoursLate}h ${remainingMinutes}m late` : 
                `${minutesLate}m late`;
            
            rowsHtml += `
                <tr class="table-warning" data-status="late">
                    <td>${profile.custom_id || '-'}</td>
                    <td>${profile.full_name || '-'}</td>
                    <td>${profile.department || 'General'}</td>
                    <td>${startDate.toLocaleDateString()}</td>
                    <td>${checkInTime.toLocaleTimeString()}</td>
                    <td>${record.check_out ? new Date(record.check_out).toLocaleTimeString() : ''}</td>
                    <td><span class="badge bg-warning"><i class="bi bi-clock-fill"></i> Late (${lateText})</span></td>
                </tr>
            `;
        }
        
        if (matchCount === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No matching records found.
                        </div>
                    </td>
                </tr>
            `;
        } else {
            console.log(`Displaying ${matchCount} late employee records`);
            attendanceList.innerHTML = rowsHtml;
        }
        
        // Update filter button to show count
        const lateFilterBtn = document.getElementById('filterLate');
        if (lateFilterBtn) {
            lateFilterBtn.textContent = `Late (${lateRecords.length})`;
        }

    } catch (err) {
        console.error('Error displaying late employees:', err);
        attendanceList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error: ${err.message}
                    </div>
                </td>
            </tr>
        `;
    }
}

async function displayAbsenteesOnly() {
    const attendanceList = document.getElementById('attendanceList');
    attendanceList.innerHTML = `
        <tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading absentees...</p>
        </td></tr>`;

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.id) throw new Error('No user data found');

        const datePicker = document.getElementById('attendanceDatePicker');
        const selectedDate = datePicker ? datePicker.value : null;

        let startDate = selectedDate ? new Date(selectedDate) : new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);

        const now = new Date();
        const sixPm = new Date(startDate);
        sixPm.setHours(18, 0, 0, 0);

        const isPastSixPm = now >= sixPm;
        const isToday = now.toDateString() === startDate.toDateString();
        const isPastDate = startDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const shouldMarkAbsent = isPastSixPm || isPastDate;

        // Get all active employees
        const { data: allEmployees, error: employeesError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, department, custom_id')
            .eq('role', 'employee')
            .eq('archived', false)
            .eq('company_id', currentUser.id);
        if (employeesError) throw employeesError;

        // Get attendance records for the day
        const { data: attendanceRecords, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select('employee_id')
            .gte('check_in', startDate.toISOString())
            .lte('check_in', endDate.toISOString())
            .eq('recorded_by', currentUser.id);
        if (attendanceError) throw attendanceError;

        const checkedInIds = new Set(attendanceRecords.map(r => r.employee_id));

        // Only mark absent if it's past 6 PM or date is in the past
        const absentees = shouldMarkAbsent
            ? allEmployees.filter(emp => !checkedInIds.has(emp.id))
            : [];

        if (absentees.length === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle me-2"></i>
                            No absentees for the selected date.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const absenteeRows = absentees.map(emp => `
            <tr class="table-danger" data-status="absent">
                <td>${emp.custom_id}</td>
                <td>${emp.full_name}</td>
                <td>${emp.department || 'General'}</td>
                <td>${startDate.toLocaleDateString()}</td>
                <td></td>
                <td></td>
                <td><span class="badge bg-danger"><i class="bi bi-x-circle-fill"></i> Absent</span></td>
            </tr>
        `).join('');

        attendanceList.innerHTML = absenteeRows;

        // Set Absent button as active and red
        document.querySelectorAll('.btn-group .btn').forEach(btn => {
            btn.classList.remove('active', 'btn-danger');
        });
        const absentBtn = Array.from(document.querySelectorAll('.btn-group .btn')).find(btn => btn.textContent.trim().toLowerCase().includes('absent'));
        if (absentBtn) {
            absentBtn.classList.add('active', 'btn-danger');
        }
    } catch (err) {
        console.error('Error displaying absentees:', err);
        attendanceList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error: ${err.message}
                    </div>
                </td>
            </tr>
        `;
    }
}



// Setup attendance status filter buttons
function setupFilterButtons() {
    const filterAll = document.getElementById('filterAll');
    const filterLate = document.getElementById('filterLate');
    const filterAbsent = document.getElementById('filterAbsent');
    
    [filterAll, filterLate, filterAbsent].forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.btn-group .btn').forEach(btn => {
                    btn.classList.remove('active');
                    btn.classList.remove('btn-secondary');
                    btn.classList.remove('btn-warning');
                    btn.classList.remove('btn-danger');
                });
                
                // Add active class and appropriate color to clicked button
                button.classList.add('active');
                if (button.id === 'filterLate') {
                    button.classList.add('btn-warning');
                    displayLateOnly();
                } else if (button.id === 'filterAbsent') {
                    button.classList.add('btn-danger');
                    displayAbsenteesOnly();
                } else {
                    button.classList.add('btn-secondary');
                    displayAllRecords();
                }
            });
        }
    });
}

// Helper function to generate attendance row
function generateAttendanceRow(employee, record, date, isWeekend) {
    const status = record ? (calculateLateness(record.check_in) > 0 ? 'late' : 'on_time') : 'absent';
    const statusClass = status === 'late' ? 'table-warning' : 
                       status === 'absent' ? 'table-danger' : '';
    
    return `
        <tr class="${statusClass}" data-status="${status}">
            <td>${employee.custom_id}</td>
            <td>${employee.full_name}</td>
            <td>${employee.department || 'General'}</td>
            <td>${date.toLocaleDateString()}</td>
            <td>${record ? record.check_in : ''}</td>
            <td>${record ? record.check_out : ''}</td>
            <td><span class="badge bg-${status === 'late' ? 'warning' : status === 'absent' ? 'danger' : 'success'}">
                <i class="bi bi-${status === 'late' ? 'clock-fill' : status === 'absent' ? 'x-circle-fill' : 'check-circle-fill'}"></i>
                ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span></td>
        </tr>
    `;
}

// Setup date picker
// Setup date picker
function setupDatePicker() {
    const datePicker = document.getElementById('attendanceDatePicker');
    const clearDateBtn = document.getElementById('clearDateBtn');
    const refreshBtn = document.getElementById('refreshAttendanceBtn');
    
    if (datePicker) {
        // Set default date to today
        const today = new Date();
        datePicker.value = today.toISOString().split('T')[0];
        
        // Add event listener for date change
        datePicker.addEventListener('change', () => {
            fetchAttendanceLogs();
        });
    }
    
    if (clearDateBtn) {
        clearDateBtn.addEventListener('click', () => {
            if (datePicker) {
                datePicker.value = '';
                fetchAttendanceLogs();
            }
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchAttendanceLogs();
        });
    }
}

// Load employee list content into the specified container
function loadEmployeesList(container) {
    // Create employees list content
    const employeesListHTML = `
        <div id="employeesListContent">
            <!-- Header -->
            <div class="d-flex justify-content-between align-items-start mb-4">
                <div>
                    <h1 class="mb-0">List of Employees</h1>
                    <p class="text-muted mb-0">Manage your company's employees</p>
                </div>
                <div>
                    <button class="btn btn-primary" onclick="showRegisterEmployeeModal()">
                        <i class="bi bi-person-plus-fill me-2"></i>
                        Register New Employee
                    </button>
                </div>
            </div>
            
            <div class="d-flex gap-2 employees-toolbar mb-4">
                <input type="text" class="form-control form-control-sm" id="employeeSearch" placeholder="Search employees...">
                <select class="form-select form-select-sm" id="departmentFilter">
                    <option value="All">All Departments</option>
                </select>
                <button class="btn btn-primary btn-sm" id="refreshEmployeesBtn">
                    <i class="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                </button>
                <div class="dropdown">
                    <button class="btn btn-success btn-sm dropdown-toggle" type="button" id="reportDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-file-earmark-arrow-down me-1"></i>
                        Export Report
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="reportDropdown">
                        <li>
                            <a class="dropdown-item" href="#" onclick="generateReport('excel')">
                                <i class="bi bi-file-earmark-excel me-2"></i>Excel Report
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" onclick="generateReport('pdf')">
                                <i class="bi bi-file-earmark-pdf me-2"></i>PDF Report
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Employee Stats Cards -->
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-0">Total Employees</h6>
                            <h2 class="mb-0" id="totalEmployees">-</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-0">Active</h6>
                            <h2 class="mb-0" id="activeEmployees">-</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-0">Archived</h6>
                            <h2 class="mb-0" id="archivedEmployees">-</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title mb-0">Departments</h6>
                            <h2 class="mb-0" id="totalDepartments">-</h2>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Employee Table -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Employee Directory</h5>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-outline-secondary btn-sm" id="showArchivedBtn">
                            <i class="bi bi-archive me-1"></i> View Archived Employees
                        </button>
                        <input type="hidden" id="showArchivedCheck" value="false">
                    </div>
                </div>
                <div class="list-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Employee ID</th>
                                    <th>Department</th>
                                    <th>Position</th>
                                    <th>Date Hired</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="employeesList">
                                <tr>
                                    <td colspan="7" class="text-center py-4">
                                        <div class="spinner-border text-primary" role="status"></div>
                                        <p class="mt-2">Loading employees...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Set content
    container.innerHTML = employeesListHTML;
    
    // Add event listeners
    const refreshBtn = document.getElementById('refreshEmployeesBtn');
    const searchInput = document.getElementById('employeeSearch');
    const departmentFilter = document.getElementById('departmentFilter');
    const showArchivedCheck = document.getElementById('showArchivedCheck');
    
    refreshBtn.addEventListener('click', () => fetchEmployeesList());
    
    if (searchInput) {
        searchInput.addEventListener('input', filterEmployees);
    }
    
    if (departmentFilter) {
        departmentFilter.addEventListener('change', filterEmployees);
    }
    
    // Add event listener for the archived employees button
    const showArchivedBtn = document.getElementById('showArchivedBtn');
    if (showArchivedBtn) {
        showArchivedBtn.addEventListener('click', function() {
            const showArchivedCheck = document.getElementById('showArchivedCheck');
            const currentValue = showArchivedCheck.value === 'true';
            showArchivedCheck.value = !currentValue;
            
            // Update button state and text
            if (!currentValue) {
                this.classList.remove('btn-outline-secondary');
                this.classList.add('btn-secondary');
                this.innerHTML = '<i class="bi bi-eye-slash me-1"></i> Show Active Employees';
            } else {
                this.classList.remove('btn-secondary');
                this.classList.add('btn-outline-secondary');
                this.innerHTML = '<i class="bi bi-archive me-1"></i> View Archived Employees';
            }
            
            // Filter employees with the new setting
            filterEmployees();
        });
    }
    
    // Load employees data
    fetchEmployeesList();
}

// Fetch employee list from Supabase
async function fetchEmployeesList() {
    console.log('Starting fetchEmployeesList with Supabase URL:', supabaseClient.supabaseUrl);
    
    try {
        const employeesList = document.getElementById('employeesList');
        if (!employeesList) {
            console.error('Employees list element not found');
            return;
        }
        
        employeesList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2">Loading employees...</p>
                </td>
            </tr>
        `;
        
        // Check authentication
        const { data: { session } } = await supabaseClient.auth.getSession();
        const currentUser = session?.user;
        
        if (!currentUser) {
            console.error('User not authenticated');
            employeesList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            You must be logged in to view employee lists.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('Current user ID:', currentUser.id);
        console.log('Fetching employees...');
        
        // Get user role
        const { data: userProfile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) {
            console.error('Error fetching user profile:', profileError);
            throw new Error('Failed to fetch user profile');
        }
        
        // Build query based on user role
        let query = supabaseClient
            .from('profiles')
            .select(`
                id,
                email,
                first_name,
                last_name,
                middle_initial,
                full_name,
                address,
                phone_number,
                salary,
                position,
                department,
                custom_id,
                role,
                company_id,
                archived,
                created_at,
                updated_at,
                gender,
                emp_type

            `)
            .order('full_name');
            
        // If user is admin, fetch all employees
        if (userProfile.role === 'admin') {
            query = query.eq('role', 'employee');
        } else {
            // For company users, fetch only their employees
            query = query.eq('company_id', currentUser.id);
        }
        
        const { data: employeeProfiles, error: fetchError } = await query;
        
        if (fetchError) {
            console.error('Error fetching employees:', fetchError);
            throw new Error('Failed to fetch employee data');
        }
        
        if (!employeeProfiles || employeeProfiles.length === 0) {
            console.log('No employee profiles found');
            employeesList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No employees found. Use the Register button to add your first employee.
                        </div>
                        <button class="btn btn-primary mt-3" onclick="showRegisterEmployeeModal()">
                            <i class="bi bi-person-plus-fill me-2"></i>
                            Register New Employee
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Store data for filtering
        window.employeesData = employeeProfiles;
        console.log(`Fetched ${window.employeesData.length} employee profiles`);
        
        // Display employees
        displayEmployees(window.employeesData);
        
        // Update stats and filters
        updateEmployeeStats(window.employeesData);
        populateDepartmentFilter(window.employeesData);
        
    } catch (error) {
        console.error('Error in fetchEmployeesList:', error);
        const employeesList = document.getElementById('employeesList');
        if (employeesList) {
            employeesList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Error: ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// Display employees in the table
function displayEmployees(employees) {
    console.log('Displaying employees:', employees);
    
    const employeesList = document.getElementById('employeesList');
    if (!employeesList) {
        console.error('Employees list element not found');
        return;
    }
    
    if (!employees || employees.length === 0) {
        console.log('No employees to display');
        employeesList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        <div>
                            <strong>No employees found.</strong>
                            <p>Employees data exists but can't be accessed due to Supabase RLS (Row Level Security) policies.</p>
                        </div>
                    </div>
                    <button class="btn btn-primary mt-3" onclick="showRegisterEmployeeModal()">
                        <i class="bi bi-person-plus-fill me-2"></i>
                        Register New Employee
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    // Clear existing content
    employeesList.innerHTML = '';
    
    // Sort employees by name
    employees.sort((a, b) => {
        return (a.full_name || '').localeCompare(b.full_name || '');
    });
    
    // Add each employee to the table
    employees.forEach(employee => {
        const initials = getInitials(employee.full_name || employee.email);
        const dateAdded = employee.created_at || 'Not Set';
        
        employeesList.innerHTML += `
            <tr data-id="${employee.id}" class="${employee.archived ? 'table-secondary' : ''}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle" style="background-color: ${stringToColor(employee.email)}">
                            ${initials}
                        </div>
                        <div class="ms-3">
                            <div class="fw-bold">${employee.full_name || 'No Name'}</div>
                            <div class="text-muted small">${employee.email}</div>
                            ${employee.archived ? '<span class="badge bg-secondary">Archived</span>' : ''}
                            <div class="fw-bold small mt-1">
                                <span class="badge bg-primary">${employee.custom_id || 'NO ID'}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="fw-bold">${employee.custom_id || 'N/A'}</div>
                </td>
                <td>${employee.department || 'Not Assigned'}</td>
                <td>${employee.position || 'Not Assigned'}</td>
                <td>${dateAdded}</td> <!-- Display the date hired as is, since it's now a string -->
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="showEmployeeDetailsModal(${JSON.stringify(employee).replace(/"/g, '&quot;')})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" onclick="showEditEmployeeModal(${JSON.stringify(employee).replace(/"/g, '&quot;')})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="showEmployeeAttendanceModal('${employee.id}', '${employee.full_name}')">
                            <i class="bi bi-calendar-check"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="${employee.archived ? 'restoreEmployee' : 'archiveEmployee'}('${employee.id}')">
                            <i class="bi ${employee.archived ? 'bi-arrow-counterclockwise' : 'bi-slash-circle'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Helper function to get initials
function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Helper function to convert string to color
function stringToColor(str) {
    // Default color if string is empty
    if (!str || str.length === 0) return '#7F7F7F';
    
    // Simple hash function to generate a consistent color from a string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert hash to hex color
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).slice(-2);
    }
    
    return color;
}

// Update employee stats
function updateEmployeeStats(employees) {
    const totalEmployees = document.getElementById('totalEmployees');
    const activeEmployees = document.getElementById('activeEmployees');
    const archivedEmployees = document.getElementById('archivedEmployees');
    const totalDepartments = document.getElementById('totalDepartments');
    
    if (totalEmployees) totalEmployees.textContent = employees.length;
    
    if (activeEmployees) {
        const active = employees.filter(emp => !emp.archived).length;
        activeEmployees.textContent = active;
    }
    
    if (archivedEmployees) {
        const archived = employees.filter(emp => emp.archived).length;
        archivedEmployees.textContent = archived;
    }
    
    if (totalDepartments) {
        const departments = new Set(employees.map(emp => emp.department).filter(Boolean));
        totalDepartments.textContent = departments.size;
    }
}

// Populate department filter
function populateDepartmentFilter(employees) {
    if (!employees) return;
    
    const departmentFilter = document.getElementById('departmentFilter');
    if (!departmentFilter) return;
    
    // Get unique departments
    const departments = [...new Set(employees
        .map(emp => emp.department || 'Unassigned')
        .filter(dept => dept))];
    
    // Sort departments alphabetically
    departments.sort();
    
    // Create options
    let options = '<option value="All">All Departments</option>';
    departments.forEach(dept => {
        options += `<option value="${dept}">${dept}</option>`;
    });
    
    // Add options to select
    departmentFilter.innerHTML = options;
}

// Filter employees based on search and department
function filterEmployees() {
    const searchTerm = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    const departmentFilter = document.getElementById('departmentFilter')?.value || 'All';
    const showArchived = document.getElementById('showArchivedCheck')?.value === 'true' || false;
    
    if (!window.employeesData) return;
    
    const filteredEmployees = window.employeesData.filter(employee => {
        // Filter by archive status - only show archived when button is active, only show active when button is inactive
        if (showArchived) {
            if (!employee.archived) return false;
        } else {
            if (employee.archived) return false;
        }
        
        // Filter by search term
        const matchesSearch = (
            (employee.full_name && employee.full_name.toLowerCase().includes(searchTerm)) ||
            (employee.email && employee.email.toLowerCase().includes(searchTerm)) ||
            (employee.custom_id && employee.custom_id.toLowerCase().includes(searchTerm)) ||
            (employee.department && employee.department.toLowerCase().includes(searchTerm)) ||
            (employee.position && employee.position.toLowerCase().includes(searchTerm))
        );
        
        // Filter by department
        const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter;
        
        return matchesSearch && matchesDepartment;
    });
    
    displayEmployees(filteredEmployees);
}

// Function to show edit employee modal
function showEditEmployeeModal(employee) {
    console.log('Showing edit modal for employee:', employee);
    
    // Create modal if it doesn't exist
    if (!document.getElementById('editEmployeeModal')) {
        const modalHTML = `
            <div class="modal fade" id="editEmployeeModal" tabindex="-1" aria-labelledby="editEmployeeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editEmployeeModalLabel">Edit Employee</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editEmployeeForm">
                                <input type="hidden" id="editEmployeeId">
                                
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="editEmployeeFirstName" class="form-label">First Name</label>
                                        <input type="text" class="form-control" id="editEmployeeFirstName" required>
                                    </div>
                                    <div class="col-2">
                                        <label for="editEmployeeMiddleInitial" class="form-label">M.I.</label>
                                        <input type="text" class="form-control" id="editEmployeeMiddleInitial" maxlength="1">
                                    </div>
                                    <div class="col">
                                        <label for="editEmployeeLastName" class="form-label">Last Name</label>
                                        <input type="text" class="form-control" id="editEmployeeLastName" required>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeeEmail" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="editEmployeeEmail" disabled>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeeCustomId" class="form-label">Employee ID</label>
                                    <input type="text" class="form-control" id="editEmployeeCustomId" disabled>
                                    <small class="form-text text-muted">Employee ID is auto-generated and cannot be changed.</small>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="editEmployeeDepartment" class="form-label">Department</label>
                                        <input type="text" class="form-control" id="editEmployeeDepartment" placeholder="Enter department">
                                    </div>
                                    <div class="col">
                                        <label for="editEmployeePosition" class="form-label">Position</label>
                                        <input type="text" class="form-control" id="editEmployeePosition" placeholder="Enter position">
                                    </div>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="editEmployeeGender" class="form-label">Gender</label>
                                        <select class="form-select" id="editEmployeeGender">
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div class="col">
                                        <label for="editEmployeeType" class="form-label">Employee Type</label>
                                        <select class="form-select" id="editEmployeeType">
                                            <option value="">Select Type</option>
                                            <option value="Full Timer">Full Timer</option>
                                            <option value="Part Timer">Part Timer</option>
                                        </select>
                                    </div>
                                    <div class="col">
                                        <label for="editEmployeeSalary" class="form-label">Salary</label>
                                        <input type="number" class="form-control" id="editEmployeeSalary" step="0.01" min="0">
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeeAddress" class="form-label">Address</label>
                                    <textarea class="form-control" id="editEmployeeAddress" rows="2"></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeePhone" class="form-label">Phone Number</label>
                                    <input type="text" class="form-control" id="editEmployeePhone" placeholder="Enter phone number">
                                </div>
                                
                                <div class="alert alert-success d-none" id="editSuccessAlert">
                                    Employee updated successfully!
                                </div>
                                
                                <div class="alert alert-danger d-none" id="editErrorAlert"></div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveEmployeeBtn">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listener to save button
        document.getElementById('saveEmployeeBtn').addEventListener('click', saveEmployeeChanges);
    }
    
    // Hide any previous alerts
    const successAlert = document.getElementById('editSuccessAlert');
    const errorAlert = document.getElementById('editErrorAlert');
    if (successAlert) successAlert.classList.add('d-none');
    if (errorAlert) errorAlert.classList.add('d-none');
    
    // Make sure we have the full employee data with all fields
    const employeeData = window.employeesData.find(emp => emp.id === employee.id) || employee;
    console.log('Using employee data for form:', employeeData);
    
    // Populate modal with employee data
    document.getElementById('editEmployeeId').value = employeeData.id;
    document.getElementById('editEmployeeFirstName').value = employeeData.first_name || '';
    document.getElementById('editEmployeeMiddleInitial').value = employeeData.middle_initial || '';
    document.getElementById('editEmployeeLastName').value = employeeData.last_name || '';
    document.getElementById('editEmployeeEmail').value = employeeData.email || '';
    document.getElementById('editEmployeeCustomId').value = employeeData.custom_id || '';
    document.getElementById('editEmployeeDepartment').value = employeeData.department || '';
    document.getElementById('editEmployeePosition').value = employeeData.position || '';
    document.getElementById('editEmployeeGender').value = employeeData.gender || '';
    document.getElementById('editEmployeeType').value = employeeData.emp_type || '';
    document.getElementById('editEmployeeSalary').value = employeeData.salary || '';
    document.getElementById('editEmployeeAddress').value = employeeData.address || '';
    document.getElementById('editEmployeePhone').value = employeeData.phone_number || '';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('editEmployeeModal'));
    modal.show();
}

// Function to save employee changes
async function saveEmployeeChanges() {
    // Get data from form
    const employeeId = document.getElementById('editEmployeeId').value;
    const firstName = document.getElementById('editEmployeeFirstName').value.trim();
    const middleInitial = document.getElementById('editEmployeeMiddleInitial').value.trim();
    const lastName = document.getElementById('editEmployeeLastName').value.trim();
    const department = document.getElementById('editEmployeeDepartment').value.trim();
    const position = document.getElementById('editEmployeePosition').value.trim();
    const gender = document.getElementById('editEmployeeGender').value;
    const empType = document.getElementById('editEmployeeType').value;
    const salary = document.getElementById('editEmployeeSalary').value.trim();
    const address = document.getElementById('editEmployeeAddress').value.trim();
    const phoneNumber = document.getElementById('editEmployeePhone').value.trim();
    
    console.log('Saving employee changes:', { 
        employeeId, 
        firstName,
        middleInitial,
        lastName,
        department, 
        position, 
        gender, 
        empType,
        salary,
        address,
        phoneNumber
    });
    
    // Show loading state
    const saveBtn = document.getElementById('saveEmployeeBtn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    saveBtn.disabled = true;
    
    try {
        // Clear previous alerts
        document.getElementById('editSuccessAlert').classList.add('d-none');
        document.getElementById('editErrorAlert').classList.add('d-none');
        
        // Get the complete employee data
        const employee = window.employeesData.find(emp => emp.id === employeeId);
        if (!employee) {
            throw new Error('Employee data not found');
        }
        
        // Get current user for role/permission checking
        const { data: { session } } = await supabaseClient.auth.getSession();
        const currentUser = session?.user;
        
        if (!currentUser) {
            throw new Error('You must be logged in to edit employees');
        }
        
        // Create update object
        const updateData = {
            first_name: firstName,
            middle_initial: middleInitial,
            last_name: lastName,
            department: department,
            position: position,
            gender: gender,
            emp_type: empType,
            salary: salary ? parseFloat(salary) : null,
            address: address,
            phone_number: phoneNumber,
            updated_at: new Date().toISOString()
        };
        
        console.log('Update data:', updateData);
        
        // Update the profile
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', employeeId);
            
        if (updateError) {
            console.error('Error updating employee:', updateError);
            throw new Error(`Failed to update employee: ${updateError.message}`);
        }
        
        // Show success message
        document.getElementById('editSuccessAlert').classList.remove('d-none');
        document.getElementById('editSuccessAlert').textContent = 'Employee updated successfully!';
        
        // Refresh the employee list
        await fetchEmployeesList();
        
        // Close modal after successful update
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal'));
            if (modal) {
                modal.hide();
            }
        }, 1500);
        
    } catch (err) {
        console.error('Error updating employee:', err);
        const errorAlert = document.getElementById('editErrorAlert');
        errorAlert.textContent = `Error: ${err.message}`;
        errorAlert.classList.remove('d-none');
    } finally {
        // Restore button state
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
    }
}

// Function to delete an employee
async function deleteEmployee(employeeId) {
    if (!employeeId) return;
    
    try {
        showLoading(true);
        
        // Delete employee from Supabase
        const { error } = await supabaseClient
            .from('profiles')
            .delete()
            .eq('id', employeeId);
        
        if (error) {
            console.error('Error deleting employee:', error);
            showToast('Error', `Failed to delete employee: ${error.message}`, 'danger');
        } else {
            showToast('Success', 'Employee deleted successfully', 'success');
            
            // Refresh the employee list
            fetchEmployeesList();
        }
    } catch (err) {
        console.error('Error in delete operation:', err);
        showToast('Error', 'An unexpected error occurred while deleting the employee', 'danger');
    } finally {
        showLoading(false);
    }
}

// Show the register employee modal
function showRegisterEmployeeModal() {
    // Create modal if it doesn't exist
    let registerEmployeeModal = document.getElementById('registerEmployeeModal');
    
    if (!registerEmployeeModal) {
        const modalHtml = `
            <div class="modal fade" id="registerEmployeeModal" tabindex="-1" aria-labelledby="registerEmployeeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="registerEmployeeModalLabel">Register New Employee</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="registerEmployeeForm">
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="employeeFirstName" class="form-label">First Name</label>
                                        <input type="text" class="form-control" id="employeeFirstName" required>
                                    </div>
                                    <div class="col-2">
                                        <label for="employeeMiddleInitial" class="form-label">M.I.</label>
                                        <input type="text" class="form-control" id="employeeMiddleInitial" maxlength="1">
                                    </div>
                                    <div class="col">
                                        <label for="employeeLastName" class="form-label">Last Name</label>
                                        <input type="text" class="form-control" id="employeeLastName" required>
                                    </div>
                                </div>
                                <div class="col mb-3">
                                    <label for="employeeGender" class="form-label">Gender</label>
                                    <select class="form-select" id="employeeGender">
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div class="alert alert-info mb-3">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Employee ID will be automatically generated after registration.
                                </div>
                                <div class="mb-3">
                                    <label for="employeeEmail" class="form-label">Email Address</label>
                                    <input type="email" class="form-control" id="employeeEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label for="employeePassword" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="employeePassword" required>
                                    <div class="form-text">Minimum 6 characters.</div>
                                </div>
                                <div class="mb-3">
                                    <label for="employeeAddress" class="form-label">Address</label>
                                    <textarea class="form-control" id="employeeAddress" rows="2"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label for="employeePhoneNumber" class="form-label">Phone Number</label>
                                    <input type="number" class="form-control" id="employeePhoneNumber">
                                </div>
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="employeeDepartment" class="form-label">Department</label>
                                        <input type="text" class="form-control" id="employeeDepartment">
                                    </div>
                                    <div class="col">
                                        <label for="employeePosition" class="form-label">Position</label>
                                        <input type="text" class="form-control" id="employeePosition">
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col">
                                        <label for="employeeRole" class="form-label">Role</label>
                                        <select class="form-select" id="employeeRole" required>
                                            <option value="employee">Employee</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div class="col mb-3">
                                    <label for="employeeType" class="form-label">Type of Employee</label>
                                    <select class="form-select" id="employeeType">
                                        <option value="">Select Type</option>
                                        <option value="Full Timer">Full Timer</option>
                                        <option value="Part Timer">Part Timer</option>
                                    </select>
                                </div>
                                <div class="col mb-3">
                                    <label for="employeeSalary" class="form-label">Salary</label>   
                                    <input type="number" class="form-control" id="employeeSalary" step="0.01" min="0">
                                </div>
                                <div class="col mb-3">
                                    <label for="date" class="form-label">Date Hired</label> 
                                    <input type="date" id="date" name="date" class="form-control" />
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="registerEmployee()">Register Employee</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        registerEmployeeModal = document.getElementById('registerEmployeeModal');
    }
    
    // Clear form fields
    document.getElementById('registerEmployeeForm').reset();
    
    // Show the modal
    const modal = new bootstrap.Modal(registerEmployeeModal);
    modal.show();
}

// Register a new employee
async function registerEmployee() {
    try {
        // Get form values
        const firstName = document.getElementById('employeeFirstName').value.trim();
        const middleInitial = document.getElementById('employeeMiddleInitial').value.trim();
        const lastName = document.getElementById('employeeLastName').value.trim();
        const email = document.getElementById('employeeEmail').value.trim();
        const password = document.getElementById('employeePassword').value;
        const address = document.getElementById('employeeAddress').value.trim();
        const phoneNumber = document.getElementById('employeePhoneNumber').value.trim();
        const department = document.getElementById('employeeDepartment').value.trim();
        const position = document.getElementById('employeePosition').value.trim();              
        const salary = document.getElementById('employeeSalary').value.trim();
        const role = document.getElementById('employeeRole').value;
        const gender = document.getElementById('employeeGender').value;
        const empType = document.getElementById('employeeType').value;
        const dateAdded = document.getElementById('date').value;

        // Format the date 
        const formattedDate = new Date(dateAdded).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });


        // Validate required fields
        if (!firstName || !lastName || !email || !password || !role || !dateAdded) {
            showToast('Validation Error', 'Please fill in all required fields.', 'danger');
            return;
        }
        
        // Validate password length
        if (password.length < 6) {
            showToast('Validation Error', 'Password must be at least 6 characters.', 'danger');
            return;
        }
        
        // Show loading
        showLoading(true);
        
        console.log('Register employee: Starting registration process', {firstName, lastName, email, role});
        
        // First check if email already exists
        try {
            const { data: existingUsers, error: checkError } = await supabaseClient
                .from('profiles')
                .select('id, email')
                .eq('email', email)
                .limit(1);
                
            if (checkError) {
                console.error('Error checking existing user:', checkError);
            } else if (existingUsers && existingUsers.length > 0) {
                showToast('Error', 'An account with this email already exists.', 'danger');
                showLoading(false);
                return;
            }
        } catch (checkErr) {
            console.warn('Error while checking for existing user:', checkErr);
            // Continue anyway, the signup will fail if user exists
        }
        
        // Get the current user for company_id
        const { data: { session } } = await supabaseClient.auth.getSession();
        const currentUser = session?.user;
        
        if (!currentUser) {
            showToast('Authentication Error', 'You must be logged in to register employees.', 'danger');
            showLoading(false);
            return;
        }
        
        console.log('Register employee: Current user', currentUser);
        
        // Use the current user's ID as the company_id regardless of role
        const company_id = currentUser.id;
        
        // Store current auth state
        const currentSession = await supabaseClient.auth.getSession();
        let userCreated = false;
        let userId = null;
        
        try {
            // 1. Sign up the new user
            console.log('Register employee: Creating auth user');
            const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { 
                        first_name: firstName,
                        last_name: lastName,
                        company_id: company_id,
                        role: role
                    }
                }
            });
            
            if (signUpError) {
                console.error('Register employee: Auth signup error', signUpError);
                throw new Error(`Failed to create user: ${signUpError.message}`);
            }
            
            if (!signUpData.user) {
                console.error('Register employee: No user data returned');
                throw new Error('User creation failed with no error. Please try again.');
            }
            
            console.log('Register employee: User created successfully', signUpData.user);
            userCreated = true;
            userId = signUpData.user.id;
            
            // 2. // Create the profile record using force_create_profile with correct parameters
            const { data: profileData, error: profileError } = await supabaseClient.rpc('force_create_profile', {
                user_id: signUpData.user.id,
                user_email: email,
                user_role: role,
                first_name: firstName,
                last_name: lastName,
                middle_initial: middleInitial || null,
                address: address || null,
                phone_number: phoneNumber || null,
                gender: gender || null,
                emp_type: empType || null,
                department: department || null,
                position: position || null,
                salary: salary ? parseFloat(salary) : null,
                custom_id: null, // Will be auto-generated by trigger
                company_id: company_id,
                created_at: formattedDate
            });

            
            if (profileError) {
                console.error('Register employee: Profile creation error', profileError);
                throw new Error(`Failed to create profile: ${profileError.message}`);
            }
            
            // Success - show message and close modal
            showToast('Success', `${firstName} ${lastName} has been registered successfully.`, 'success');
            
            // Hide modal
            const registerEmployeeModal = document.getElementById('registerEmployeeModal');
            const modal = bootstrap.Modal.getInstance(registerEmployeeModal);
            modal.hide();
            
            // Refresh employee list
            fetchEmployeesList();
            
        } catch (error) {
            console.error('Error in registration process:', error);
            showToast('Registration Error', `${error.message || 'Unexpected error occurred'}`, 'danger');
        } finally {
            // Restore the original session to make sure we're still logged in as admin
            try {
                if (currentSession?.data?.session) {
                    await supabaseClient.auth.setSession(currentSession.data.session);
                } else {
                    // If we can't restore session, refresh the page
                    window.location.reload();
                    return;
                }
            } catch (sessionError) {
                console.error('Error restoring session:', sessionError);
                // Don't block the process for session errors
            }
            showLoading(false);
        }
    } catch (error) {
        console.error('Error registering employee:', error);
        showToast('Registration Error', `${error.message || 'Unexpected error occurred'}`, 'danger');
        showLoading(false);
    }
}    

// Replace deleteEmployee with archiveEmployee
async function archiveEmployee(employeeId) {
    try {
        if (!employeeId) return;
        
        if (!confirm('Are you sure you want to archive this employee?')) {
            return;
        }
        
        showLoading(true);
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ archived: true })
            .eq('id', employeeId);
            
        if (error) {
            console.error('Error archiving employee:', error);
            showToast('Archive Error', `Failed to archive employee: ${error.message}`, 'danger');
            return;
        }
        
        showToast('Success', 'Employee has been archived.', 'success');
        fetchEmployeesList();
    } catch (error) {
        console.error('Error archiving employee:', error);
        showToast('Archive Error', `Unexpected error: ${error.message}`, 'danger');
    } finally {
        showLoading(false);
    }
}

// Add restore employee function
async function restoreEmployee(employeeId) {
    try {
        if (!employeeId) return;
        
        if (!confirm('Are you sure you want to restore this employee?')) {
            return;
        }
        
        showLoading(true);
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ archived: false })
            .eq('id', employeeId);
            
        if (error) {
            console.error('Error restoring employee:', error);
            showToast('Restore Error', `Failed to restore employee: ${error.message}`, 'danger');
            return;
        }
        
        showToast('Success', 'Employee has been restored.', 'success');
        fetchEmployeesList();
    } catch (error) {
        console.error('Error restoring employee:', error);
        showToast('Restore Error', `Unexpected error: ${error.message}`, 'danger');
    } finally {
        showLoading(false);
    }
}

// Add function to generate PDF/Excel reports
function generateReport(type) {
    try {
        showLoading(true);
        
        if (!window.employeesData || window.employeesData.length === 0) {
            showToast('Report Error', 'No employee data to export.', 'warning');
            showLoading(false);
            return;
        }
        
        if (type === 'pdf') {
            generatePdfReport(window.employeesData);
        } else if (type === 'excel') {
            generateExcelReport(window.employeesData);
        }
    } catch (error) {
        console.error(`Error generating ${type} report:`, error);
        showToast('Report Error', `Failed to generate ${type} report: ${error.message}`, 'danger');
    } finally {
        showLoading(false);
    }
}

// Generate PDF report
function generatePdfReport(data) {
    // Filter out archived employees unless specifically requested
    const activeEmployees = data.filter(emp => !emp.archived);
    
    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Employee Report', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 22, { align: 'center' });
    
    // Create table
    const tableColumn = ["Name", "ID", "Department", "Position", "Email", "Gender", "Type of Employee", "Salary", "Date Hired", "Status"];
    const tableRows = [];
    
    activeEmployees.forEach(employee => {
        const employeeData = [
            employee.full_name || 'N/A',
            employee.custom_id || 'N/A',
            employee.department || 'N/A',
            employee.position || 'N/A',
            employee.email,
            employee.gender || 'N/A',
            employee.emp_type || 'N/A',
            employee.salary || 'N/A',
            employee.created_at || 'N/A',
            employee.archived ? 'Archived' : 'Active'
        ];      
        tableRows.push(employeeData);
    });
    
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 3,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255
        }
    });
    
    // Save the PDF
    doc.save('employee-report.pdf');
    
    showToast('Success', 'PDF report has been generated.', 'success');
}

// Generate Excel report
function generateExcelReport(data) {
    // Filter out archived employees unless specifically requested
    const activeEmployees = data.filter(emp => !emp.archived);
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Create a new worksheet with employee data
    const worksheet = XLSX.utils.json_to_sheet(activeEmployees.map(employee => {
        return {
            'Name': employee.full_name || 'N/A',
            'Employee ID': employee.custom_id || 'N/A',
            'Email': employee.email,
            'Department': employee.department || 'N/A',
            'Position': employee.position || 'N/A',
            'Salary': employee.salary || 'N/A',
            'Address': employee.address || 'N/A',
            'Phone Number': employee.phone_number || 'N/A',
            'Gender': employee.gender || 'N/A',
            'Type of Employee': employee.emp_type || 'N/A',
            'Date Hired': employee.created_at || 'Not Set', // Use the date string directly
        };
    }));
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, 'employee-report.xlsx');
    
    showToast('Success', 'Excel report has been generated.', 'success');
}

// Ensure necessary database tables exist
async function ensureTablesExist() {
    console.log("Checking database tables...");
    
    try {
        // Check if we can connect to Supabase first
        const { data: serverTime, error: connectionError } = await supabaseClient.rpc('get_server_time');
        
        if (connectionError) {
            console.error("Cannot connect to Supabase:", connectionError);
            // Don't block app initialization for this - just log it
            return;
        }
        
        console.log("Supabase connection successful, server time:", serverTime);
        
        // Check if profiles table exists
        let tableExists = false;
        try {
            const { count, error: countError } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .limit(1);
                
            if (!countError) {
                tableExists = true;
                console.log("Profiles table exists");
            } else if (countError.code === '42P01') { // Table doesn't exist
                console.log("Profiles table doesn't exist yet");
            } else {
                console.error("Error checking profiles table:", countError);
            }
        } catch (error) {
            console.error("Exception checking profiles table:", error);
        }
        
        // If profiles table doesn't exist, create it
        if (!tableExists) {
            console.log("Attempting to create profiles table");
            
            try {
                const { error: createError } = await supabaseClient.rpc('exec_sql', {
                    sql_query: `
                    CREATE TABLE IF NOT EXISTS public.profiles (
                        id UUID PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        first_name TEXT,
                        last_name TEXT,
                        middle_initial TEXT,
                        full_name TEXT,
                        address TEXT,
                        phone_number TEXT,
                        position TEXT,
                        department TEXT,
                        salary NUMERIC,
                        custom_id TEXT UNIQUE,
                        role TEXT NOT NULL DEFAULT 'employee',
                        company_id UUID,
                        archived BOOLEAN DEFAULT false,
                        created_at VARCHAR(50), // Changed from TIMESTAMP WITH TIME ZONE
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
                    );
                    
                    -- Create index on profiles
                    CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
                    CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
                    CREATE INDEX IF NOT EXISTS idx_profiles_archived ON public.profiles(archived);
                    CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
                    CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
                    CREATE INDEX IF NOT EXISTS idx_profiles_type ON public.profiles(type);
                

                    -- Enable Row Level Security
                    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
                    
                    -- RLS Policy: Allow authenticated users to read profiles
                    CREATE POLICY IF NOT EXISTS read_all_profiles ON public.profiles
                        FOR SELECT USING (auth.role() = 'authenticated');
                    
                    -- RLS Policy: Users can update their own profile
                    CREATE POLICY IF NOT EXISTS user_update_own_profile ON public.profiles
                        FOR UPDATE USING (id = auth.uid());
                    `
                });
                
                if (createError) {
                    console.error("Error creating profiles table:", createError);
                } else {
                    console.log("Successfully created profiles table");
                }
            } catch (error) {
                console.error("Exception creating profiles table:", error);
            }
        }
        
        // Check if the create_profile_for_user function exists
        try {
            const { data: funcExists, error: funcError } = await supabaseClient.rpc('create_profile_for_user', {
                user_id: '00000000-0000-0000-0000-000000000000',
                user_email: 'test@example.com',
                user_role: 'test',
                user_full_name: 'Test User',
                user_gender: 'male',
                user_type: 'full_timer'
            });
            
            // If we get a foreign key error, that means the function exists but failed due to invalid UUID
            // If we get a function not found error, we need to create it
            if (funcError && funcError.code === '42883') { // Function not found
                console.log("create_profile_for_user function doesn't exist, creating it");
                
                const { error: createFuncError } = await supabaseClient.rpc('exec_sql', {
                    sql_query: `
                    CREATE OR REPLACE FUNCTION public.create_profile_for_user(
                        user_id UUID,
                        user_email TEXT,
                        user_role TEXT,
                        user_full_name TEXT,
                        user_gender TEXT,
                        user_type TEXT,
                        company_id UUID DEFAULT NULL
                    ) RETURNS void AS $$
                    BEGIN
                        -- Insert the profile
                        INSERT INTO public.profiles (
                            id,
                            email,
                            role,
                            full_name,
                            gender,
                            type,
                            company_id,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            user_id,
                            user_email,
                            user_role,
                            user_full_name,
                            user_gender,
                            user_type,
                            company_id,
                            now(),
                            now()
                        );
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;
                    `
                });
                
                if (createFuncError) {
                    console.error("Error creating create_profile_for_user function:", createFuncError);
                } else {
                    console.log("Successfully created create_profile_for_user function");
                }
            } else {
                console.log("create_profile_for_user function exists");
            }
        } catch (error) {
            console.error("Exception checking or creating function:", error);
        }
        
        // Also check if the exec_sql function exists
        try {
            const { data: sqlFuncExists, error: sqlFuncError } = await supabaseClient.rpc('exec_sql', {
                sql_query: 'SELECT 1;'
            });
            
            if (sqlFuncError && sqlFuncError.code === '42883') { // Function not found
                console.log("exec_sql function doesn't exist, creating it");
                
                // We'll need to use direct SQL through the auth API since we can't create a function without the function
                // This is a bit of a catch-22, so this might not work without admin intervention
                console.warn("Cannot automatically create exec_sql function - may require manual setup");
                
                // Show a warning toast but don't block initialization
                showToast('Setup Required', 'Database setup required. Please contact support or run the setup script.', 'warning');
            } else {
                console.log("exec_sql function exists");
            }
        } catch (error) {
            console.error("Exception checking exec_sql function:", error);
        }
        
    } catch (error) {
        console.error("Error in ensureTablesExist:", error);
        // Don't block app initialization for this
    }
}

// Test database connection
async function testDatabaseConnection() {
    console.log('Testing database connection...');
    try {
        // First try a simpler query instead of RPC
        const { data: pingData, error: pingError } = await supabaseClient
            .from('profiles')
            .select('count()', { count: 'exact', head: true });
            
        if (pingError) {
            console.log('Primary database test failed, trying backup method:', pingError);
            
            // Try a simpler authentication check as backup
            const { data: authData } = await supabaseClient.auth.getSession();
            
            if (authData && authData.session) {
                console.log('Connection verified through session check');
                return true;
            }
            
            console.error('Database connection test failed:', pingError);
            showToast('Connection Warning', 'Database connection may be unstable. Will try to save anyway.', 'warning');
            // Continue anyway - don't return false here
            return true;
        }
        
        console.log('Database connection successful');
        return true;
    } catch (err) {
        console.error('Exception testing database connection:', err);
        // Don't block the save operation - show warning but continue
        showToast('Connection Warning', 'Database connection check failed but will try to save anyway.', 'warning');
        return true;
    }
}

// Function to show employee personal details modal
function showEmployeeDetailsModal(employee) {
    console.log('Showing details for employee:', employee);
    
    // Create modal if it doesn't exist
    if (!document.getElementById('employeeDetailsModal')) {
        const modalHTML = `
            <div class="modal fade" id="employeeDetailsModal" tabindex="-1" aria-labelledby="employeeDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="employeeDetailsModalLabel">Employee Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4 align-items-center">
                                <div class="col-md-2 text-center">
                                    <div id="detailsAvatar" class="avatar-circle mx-auto" style="width: 80px; height: 80px; font-size: 2rem;"></div>
                                </div>
                                <div class="col-md-10">
                                    <h3 id="detailsName" class="mb-1"></h3>
                                    <div class="d-flex align-items-center mb-2">
                                        <span id="detailsEmployeeId" class="badge bg-primary me-2"></span>
                                        <span id="detailsRole" class="badge bg-secondary me-2"></span>
                                        <span id="detailsStatus" class="ms-2"></span>
                                    </div>
                                    <p id="detailsEmail" class="text-muted mb-0"></p>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card mb-3">
                                        <div class="card-header bg-light">
                                            <h5 class="card-title mb-0">Personal Information</h5>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Employee ID</label>
                                                <p id="detailsCustomId"></p>
                                            </div> 
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Full Name</label>
                                                <p id="detailsFullName"></p>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Gender</label>
                                                <p id="detailsGender"></p>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Employee Type</label>
                                                <p id="detailsType"></p>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Salary</label>
                                                <p id="detailsSalary"></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card mb-3">
                                        <div class="card-header bg-light">
                                            <h5 class="card-title mb-0">Contact Information</h5>
                                        </div>
                                        <div class="card-body">
                                            
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Phone Number</label>
                                                <p id="detailsPhone"></p>
                                            </div>
                                            <div>
                                                <label class="form-label fw-bold">Address</label>
                                                <p id="detailsAddress"></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card mb-3">
                                        <div class="card-header bg-light">
                                            <h5 class="card-title mb-0">Work Information</h5>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Department</label>
                                                <p id="detailsDepartment"></p>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Position</label>
                                                <p id="detailsPosition"></p>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label fw-bold">Date Hired</label>
                                                <p id="detailsDateHired"></p>
                                            </div>
                                            <div>
                                                <label class="form-label fw-bold">Last Updated</label>
                                                <p id="detailsLastUpdated"></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Store the current employee details for the edit button
    window.currentEmployeeDetails = employee;
    
    // Format salary with currency
    const formatSalary = (salary) => {
        if (!salary) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP'
        }).format(salary);
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    // Populate modal with employee data
    document.getElementById('detailsName').textContent = employee.full_name || 'No Name';
    document.getElementById('detailsFullName').textContent = employee.full_name || 'No Name';
    document.getElementById('detailsEmployeeId').textContent = employee.custom_id || 'NO ID';
    document.getElementById('detailsCustomId').textContent = employee.custom_id || 'NO ID';
    document.getElementById('detailsRole').textContent = employee.role || 'employee';
    document.getElementById('detailsGender').textContent = employee.gender || 'N/A';
    document.getElementById('detailsType').textContent = employee.emp_type || 'N/A';
    document.getElementById('detailsStatus').innerHTML = employee.archived ? 
        '<span class="badge bg-secondary">Archived</span>' : 
        '<span class="badge bg-success">Active</span>';
    document.getElementById('detailsEmail').textContent = employee.email || 'N/A';
    document.getElementById('detailsDepartment').textContent = employee.department || 'Not Assigned';
    document.getElementById('detailsPosition').textContent = employee.position || 'Not Assigned';
    document.getElementById('detailsDateHired').textContent = formatDate(employee.created_at);
    document.getElementById('detailsLastUpdated').textContent = formatDate(employee.updated_at);
    document.getElementById('detailsPhone').textContent = employee.phone_number || 'N/A';
    document.getElementById('detailsAddress').textContent = employee.address || 'N/A';
    document.getElementById('detailsSalary').textContent = formatSalary(employee.salary);
    
    // Set avatar
    const avatarElement = document.getElementById('detailsAvatar');
    const initials = getInitials(employee.full_name || employee.email);
    avatarElement.style.backgroundColor = stringToColor(employee.email);
    avatarElement.textContent = initials;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('employeeDetailsModal'));
    modal.show();
}

// Add after showEmployeeDetailsModal function
let currentEmployeeId = null;
let currentEmployeeName = null;

async function showEmployeeAttendanceModal(employeeId, employeeName) {
    currentEmployeeId = employeeId;
    currentEmployeeName = employeeName;
    
    if (!document.getElementById('employeeAttendanceModal')) {
        const modalHTML = `
            <div class="modal fade" id="employeeAttendanceModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div>
                                <h5 class="modal-title mb-1">Attendance History: <span id="employeeLogsName"></span></h5>
                                <small class="text-muted" id="employeeHireDate"></small>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Date Range Controls -->
                            <div class="mb-3">
                                <div class="d-flex gap-2 align-items-end">
                                    <div class="flex-grow-1">
                                        <label class="form-label">Filter by Date Range</label>
                                        <select class="form-select" id="dateRangeType">
                                            <option value="week">This Week</option>
                                            <option value="month">This Month</option>
                                            <option value="custom">Custom Range</option>
                                        </select>
                                    </div>
                                    <div id="customDateRange" class="d-none">
                                        <input type="date" id="startDate" class="form-control">
                                        <input type="date" id="endDate" class="form-control">
                                    </div>
                                    <button class="btn btn-primary" onclick="fetchEmployeeLogs()">
                                        <i class="bi bi-search"></i> View Records
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Filter Buttons -->
                            <div class="mb-3">
                                <div class="d-flex gap-1align-items-end">
                                    <div class="flex-grow-1">
                                        <div class="btn-group w-150" role="group">
                                            <button type="button" class="btn btn-outline-primary" id="empFilterAll" data-filter="all">All</button>
                                            <button type="button" class="btn btn-outline-success" data-filter="on-time">On Time</button>
                                            <button type="button" class="btn btn-outline-warning" id="empFilterLate" data-filter="late">Late</button>
                                            <button type="button" class="btn btn-outline-danger" id="empFilterAbsent" data-filter="absent">Absent</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Attendance Table -->
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="employeeLogsTable"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup event listeners for custom range
        const dateRangeType = document.getElementById('dateRangeType');
        const customDateRange = document.getElementById('customDateRange');
        if (dateRangeType && customDateRange) {
            dateRangeType.addEventListener('change', function() {
                if (this.value === 'custom') {
                    customDateRange.classList.remove('d-none');
                } else {
                    customDateRange.classList.add('d-none');
                }
            });
        }
        
        // In this version, we do not add filter button event listeners
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('employeeAttendanceModal'));
    document.getElementById('employeeLogsName').textContent = employeeName;
    
    // Get employee's hire date and display it
    supabaseClient
        .from('profiles')
        .select('created_at')
        .eq('id', employeeId)
        .single()
        .then(({ data }) => {
            if (data && data.created_at) {
                const hireDate = new Date(data.created_at);
                document.getElementById('employeeHireDate').textContent = `Date Hired: ${hireDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}`;
            }
        });
        
    modal.show();
    
    // Reset filter to 'all'
    currentEmployeeFilter = 'all';
    
    // Default to this week and fetch logs
    await fetchEmployeeLogs();
    
    // Initialize filter buttons to match current filter
    const filterButtons = document.querySelectorAll('#employeeAttendanceModal [data-filter]');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') {
            btn.classList.add('active');
        }
    });
}

// Current filter for employee logs
let currentEmployeeFilter = 'all';

// Setup employee attendance filter buttons
function setupEmployeeLogFilters() {
    const filterButtons = document.querySelectorAll('#employeeAttendanceModal [data-filter]');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Set current filter and re-fetch logs
            currentEmployeeFilter = button.dataset.filter;
            console.log(`Switched employee log filter to: ${currentEmployeeFilter}`);
            filterEmployeeLogs();
        });
    });
}

// Function to filter employee logs without re-fetching data
function filterEmployeeLogs() {
    console.log(`Filtering employee logs with filter: ${currentEmployeeFilter}`);
    const rows = document.querySelectorAll('#employeeLogsTable tr[data-status]');
    let matchCount = 0;

    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        const matchesFilter = currentEmployeeFilter === 'all' || status === currentEmployeeFilter;
        
        if (matchesFilter) {
            row.style.display = '';
            matchCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Show or hide the no records message
    const noRecordsRow = document.getElementById('employeeNoRecordsRow');
    if (noRecordsRow) {
        noRecordsRow.style.display = matchCount === 0 ? '' : 'none';
    }
    
    // Update filter button counts
    updateEmployeeFilterButtonCounts();
}

// Update employee filter buttons with count information
function updateEmployeeFilterButtonCounts() {
    const rows = document.querySelectorAll('#employeeLogsTable tr[data-status]');
    let counts = { all: 0, late: 0, absent: 0 };
    
    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        counts.all++;
        
        if (status === 'late') counts.late++;
        if (status === 'absent') counts.absent++;
    });
    
    // Update the button text
    document.getElementById('empFilterAll').textContent = `All (${counts.all})`;
    document.getElementById('empFilterLate').textContent = `Late (${counts.late})`;
    document.getElementById('empFilterAbsent').textContent = `Absent (${counts.absent})`;
}

async function fetchEmployeeLogs() {
    const tableBody = document.getElementById('employeeLogsTable');
    const rangeType = document.getElementById('dateRangeType').value;
    let startDate, endDate;
    const now = new Date();
    
    try {
        // First, get employee's hire date (created_at)
        const { data: employee, error: employeeError } = await supabaseClient
            .from('profiles')
            .select('created_at')
            .eq('id', currentEmployeeId)
            .single();

        if (employeeError) throw employeeError;

        const hireDate = employee?.created_at ? new Date(employee.created_at) : null;
        const now = new Date();

        switch(rangeType) {
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay()); // Start of week
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6); // End of week
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of month
                break;
            case 'custom':
                // Make sure the input elements exist
                const startDateInput = document.getElementById('startDate');
                const endDateInput = document.getElementById('endDate');
                
                if (!startDateInput || !endDateInput || !startDateInput.value || !endDateInput.value) {
                    showToast('Error', 'Please select both start and end dates', 'danger');
                    return;
                }
                
                // Parse dates and set time to start/end of day
                startDate = new Date(startDateInput.value);
                startDate.setHours(0, 0, 0, 0); // Start of day
                
                endDate = new Date(endDateInput.value);
                endDate.setHours(23, 59, 59, 999); // End of day
                
                // Validate date format
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    showToast('Error', 'Invalid date format', 'danger');
                    return;
                }
                
                console.log('Custom date range selected:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    hireDate: hireDate ? hireDate.toISOString() : 'Not set'
                });
                break;
        }

        // Get the display formatted hire date for messages
        const formattedHireDate = hireDate ? hireDate.toLocaleDateString() : 'Not specified';
        console.log('Comparing dates:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            hireDate: hireDate ? hireDate.toISOString() : 'Not set',
            isBeforeHireDate: (hireDate && endDate < hireDate)
        });
        
        // Check if the entire date range is before hire date
        if (hireDate && endDate < hireDate) {
            // If the entire selected range is before the employee was hired
            console.log('Date range is entirely before hire date');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <div class="alert alert-info mb-3">
                            Hire Date: ${formattedHireDate}
                        </div>
                        <div class="alert alert-warning">
                            <i class="bi bi-info-circle me-2"></i>
                            No attendance records available. The selected date range is before this employee was hired.
                        </div>
                    </td>
                </tr>
            `;
            return; // Exit function early
        }
        
        // Ensure startDate is not before hire date
        if (hireDate) {
            startDate = new Date(Math.max(startDate, hireDate));
        }

        // Prevent showing future dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate > today) {
            endDate = new Date(today); // Only show up to today
        }
        
        // Check if after adjustments, the date range is invalid (startDate > endDate)
        if (startDate > endDate) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <div class="alert alert-info mb-3">
                            Hire Date: ${hireDate ? hireDate.toLocaleDateString() : 'Not specified'}
                        </div>
                        <div class="alert alert-warning">
                            <i class="bi bi-info-circle me-2"></i>
                            No valid date range available after considering hire date and current date.
                        </div>
                    </td>
                </tr>
            `;
            return; // Exit function early
        }

        // Show loading state
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;

        // First, get all dates in the range to check for absences
        const dates = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Fetch attendance records
        const { data: records, error } = await supabaseClient
            .from('attendance')
            .select('*')
            .eq('employee_id', currentEmployeeId)
            .gte('check_in', startDate.toISOString())
            .lte('check_in', endDate.toISOString())
            .order('check_in', { ascending: true });

        if (error) throw error;

        // Create a map of existing attendance records
        const attendanceMap = new Map();
        records.forEach(record => {
            const dateKey = new Date(record.check_in).toDateString();
            attendanceMap.set(dateKey, record);
        });

        // Create complete attendance record including absences
        const completeRecords = dates.map(date => {
            const dateKey = date.toDateString();
            const record = attendanceMap.get(dateKey);

            if (record) {
                // Existing attendance record
                const checkIn = new Date(record.check_in);
                // Check if weekend
                const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
                if (isWeekendDay) {
                    return {
                        date: date,
                        checkIn: null,
                        checkOut: null,
                        status: 'no-office'
                    };
                }
                
                // Determine if late (after 9 AM)
                const isLate = checkIn.getHours() > 9 || 
                             (checkIn.getHours() === 9 && checkIn.getMinutes() > 0);
                return {
                    date: date,
                    checkIn: checkIn,
                    checkOut: record.check_out ? new Date(record.check_out) : null,
                    status: isLate ? 'late' : 'on_time'
                };
            } else {
                // Check if weekend
                const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
                if (isWeekendDay) {
                    return {
                        date: date,
                        checkIn: null,
                        checkOut: null,
                        status: 'no-office'
                    };
                }
                
                // Absent record for weekdays
                return {
                    date: date,
                    checkIn: null,
                    checkOut: null,
                    status: 'absent'
                };
            }
        });

        // Display records with hire date information
        const recordsHTML = completeRecords.map(record => {
            const statusClass = record.status === 'late' ? 'bg-warning' : 
                              record.status === 'absent' ? 'bg-danger' : 
                              record.status === 'no-office' ? 'bg-info' : 
                              'bg-success';
            
            // For On Time and Late status, show actual times, otherwise leave blank
            const checkInDisplay = record.status === 'on_time' || record.status === 'late' ? 
                record.checkIn.toLocaleTimeString() : '';
            
            // For check-out, only show time if available, otherwise leave blank
            const checkOutDisplay = record.checkOut ? record.checkOut.toLocaleTimeString() : '';
            
            const statusText = record.status === 'no-office' ? 'NO OFFICE' : 
                              record.status === 'on_time' ? 'ON TIME' : 
                              record.status.toUpperCase();
            
            return `
                <tr data-status="${record.status}" class="${currentEmployeeFilter !== 'all' && record.status !== currentEmployeeFilter ? 'd-none' : ''}">
                    <td>
                        ${isWeekend(record.date) ? '<i class="bi bi-calendar-week text-primary me-2"></i>' : ''}
                        ${record.date.toLocaleDateString()}
                    </td>
                    <td>${checkInDisplay}</td>
                    <td>${checkOutDisplay}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText}
                            ${record.status === 'late' ? calculateLateness(record.checkIn) : ''}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        const hasRecords = completeRecords.length > 0;
        const noRecordsMessage = `
            <tr id="employeeNoRecordsRow" style="display: none;">
                <td colspan="4" class="text-center py-4">
                    <div class="alert alert-info">
                        No matching records found.
                    </div>
                </td>
            </tr>
        `;

        tableBody.innerHTML = `
            ${noRecordsMessage}
            ${recordsHTML}
        `;
        
        // Setup filter buttons with counts
        setupEmployeeLogFilters();
        updateEmployeeFilterButtonCounts();

    } catch (error) {
        console.error('Error fetching employee logs:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error loading attendance records: ${error.message}
                    </div>
                </td>
            </tr>
        `;
    }
}

// Helper function to check if a date is weekend
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday (0) or Saturday (6)
}

// Helper function to calculate lateness
function calculateLateness(checkInTime) {
    if (!checkInTime) return 0;
    
    // Convert to Date object if it's a string
    const checkIn = checkInTime instanceof Date ? checkInTime : new Date(checkInTime);
    
    // Expected time is 9:00 AM on the same day
    const expectedTime = new Date(checkIn);
    expectedTime.setHours(9, 0, 0, 0);
    
    // Calculate minutes late (max with 0 to avoid negative values)
    const lateBy = Math.max(0, Math.floor((checkIn - expectedTime) / (1000 * 60)));
    
    return lateBy;
}

// Helper function to format lateness string
function formatLateness(minutesLate) {
    if (!minutesLate || minutesLate <= 0) return '';
    
    const hours = Math.floor(minutesLate / 60);
    const minutes = minutesLate % 60;
    
    return hours > 0 ? 
        ` (${hours}h ${minutes}m late)` : 
        ` (${minutes}m late)`;
}

