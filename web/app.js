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
                            created_at: new Date().toISOString(),
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
                    <button class="btn btn-primary btn-sm" id="refreshAttendanceBtn">
                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0">Attendance Records</h5>
                </div>
                <div class="card-body p-0">
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
                                </tr>
                            </thead>
                            <tbody id="attendanceList">
                                <tr>
                                    <td colspan="6" class="text-center py-4">
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
                <td colspan="6" class="text-center py-4">
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
                    <td colspan="6" class="text-center py-4">
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
        
        // Fetch attendance records with an additional filter for non-archived employees
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
            .order('check_in', { ascending: false });
        
        if (attendanceError) {
            console.error('Error fetching attendance records:', attendanceError);
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Error: ${attendanceError.message}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Filter out attendance records of archived employees
        const activeAttendanceRecords = attendanceRecords.filter(record => 
            record.profiles && !record.profiles.archived
        );
        
        if (!activeAttendanceRecords || activeAttendanceRecords.length === 0) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No attendance records found for the selected period.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Process and display attendance records
        const attendanceHTML = activeAttendanceRecords.map(record => {
            const checkInDate = new Date(record.check_in);
            const checkOutDate = record.check_out ? new Date(record.check_out) : null;
            
            // Format times
            const checkInTime = checkInDate.toLocaleTimeString();
            const checkOutTime = checkOutDate ? checkOutDate.toLocaleTimeString() : '-';
            
            // Determine if check-in is late (after 9 AM)
            const isLateCheckIn = checkInDate.getHours() > 9 || 
                                 (checkInDate.getHours() === 9 && checkInDate.getMinutes() > 0);
            
            // Determine if check-out is late (after 5 PM)
            const isLateCheckOut = checkOutDate && 
                                 (checkOutDate.getHours() > 17 || 
                                 (checkOutDate.getHours() === 17 && checkOutDate.getMinutes() > 0));
            
            return `
                <tr>
                    <td>${record.profiles.custom_id || record.employee_id}</td>
                    <td>${record.profiles.full_name || 'Unknown'}</td>
                    <td>${record.profiles.department || 'General'}</td>
                    <td>${checkInDate.toLocaleDateString()}</td>
                    <td class="${isLateCheckIn ? 'text-warning' : ''}">${checkInTime}</td>
                    <td class="${isLateCheckOut ? 'text-danger' : ''}">${checkOutTime}</td>
                </tr>
            `;
        }).join('');
        
        attendanceList.innerHTML = attendanceHTML;
        
    } catch (error) {
        console.error('Error in fetchAttendanceLogs:', error);
        const attendanceList = document.getElementById('attendanceList');
        if (attendanceList) {
            attendanceList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
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

// Filter attendance logs based on search and date filter
function filterAttendanceLogs() {
    console.log('Filtering attendance logs');
    
    const searchInput = document.getElementById('attendanceSearch');
    const dateFilter = document.getElementById('attendanceDateFilter');
    
    if (!searchInput || !dateFilter) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const dateFilterValue = dateFilter.value;
    
    // If date filter changed, fetch new data
    if (dateFilterValue !== localStorage.getItem('lastDateFilter')) {
        localStorage.setItem('lastDateFilter', dateFilterValue);
        fetchAttendanceLogs();
        return;
    }
    
    // Get all rows from the table
    const rows = document.querySelectorAll('#attendanceList tr');
    
    // Filter based on search term
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return; // Skip if not a data row
        
        const employeeId = cells[0].textContent.toLowerCase();
        const name = cells[1].textContent.toLowerCase();
        const department = cells[2].textContent.toLowerCase();
        
        const matchesSearch = !searchTerm || 
            employeeId.includes(searchTerm) ||
            name.includes(searchTerm) ||
            department.includes(searchTerm);
        
        row.style.display = matchesSearch ? '' : 'none';
    });
}

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
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="showArchivedCheck">
                        <label class="form-check-label" for="showArchivedCheck">
                            Show archived employees
                        </label>
                    </div>
                </div>
                <div class="card-body">
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
                                    <td colspan="6" class="text-center py-4">
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
    
    if (showArchivedCheck) {
        showArchivedCheck.addEventListener('change', filterEmployees);
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
                <td colspan="6" class="text-center py-4">
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
                    <td colspan="6" class="text-center py-4">
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
        
        try {
            // Try multiple approaches to fetch employees
            let employeeProfiles = null;
            let fetchError = null;
            
            // First try with proper company_id filter 
            const { data: companyData, error: companyError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('company_id', currentUser.id)
                .order('full_name');
                
            if (!companyError && companyData && companyData.length > 0) {
                console.log('Successfully fetched employees via company_id:', companyData.length);
                employeeProfiles = companyData;
            } else {
                console.log('Company filter query failed or returned no results:', companyError);
                fetchError = companyError;
                
                // Try with alternative OR condition
                const { data: employeeData, error: employeeError } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .or(`company_id.eq.${currentUser.id},role.eq.employee`)
                    .order('full_name');
                    
                if (!employeeError && employeeData && employeeData.length > 0) {
                    // Filter to only include employees for this company, not the current user
                    employeeProfiles = employeeData.filter(profile => 
                        (profile.role === 'employee' && profile.company_id === currentUser.id) || 
                        profile.id !== currentUser.id
                    );
                    
                    console.log('Successfully fetched employees with OR condition:', employeeProfiles.length);
                } else {
                    console.log('OR condition query failed or returned no results:', employeeError);
                    fetchError = employeeError || fetchError;
                    
                    // Try one last approach - just fetching employees with this company_id
                    const { data: roleData, error: roleError } = await supabaseClient
                        .from('profiles') 
                        .select('*')
                        .eq('role', 'employee')
                        .eq('company_id', currentUser.id)
                        .order('full_name');
                        
                    if (!roleError && roleData && roleData.length > 0) {
                        console.log('Successfully fetched employees via role and company_id:', roleData.length);
                        employeeProfiles = roleData;
                    } else {
                        console.log('Role and company_id query failed or returned no results:', roleError);
                        fetchError = roleError || employeeError || companyError;
                    }
                }
            }
            
            // Handle no results case
            if (!employeeProfiles || employeeProfiles.length === 0) {
                console.log('No employee profiles found after all attempts');
                
                employeesList.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4">
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
        } catch (queryError) {
            console.error('Exception during employee query:', queryError);
            employeesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Exception: ${queryError.message}
                        </div>
                        <button class="btn btn-primary mt-3" onclick="showRegisterEmployeeModal()">
                            <i class="bi bi-person-plus-fill me-2"></i>
                            Register New Employee
                        </button>
                    </td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error('Unexpected error in fetchEmployeesList:', error);
        const employeesList = document.getElementById('employeesList');
        if (employeesList) {
            employeesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Unexpected error: ${error.message}
                        </div>
                        <button class="btn btn-primary mt-3" onclick="showRegisterEmployeeModal()">
                            <i class="bi bi-person-plus-fill me-2"></i>
                            Register New Employee
                        </button>
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
                <td colspan="6" class="text-center py-4">
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
                <td>${new Date(employee.created_at).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="showEmployeeDetailsModal(${JSON.stringify(employee).replace(/"/g, '&quot;')})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" onclick="showEditEmployeeModal(${JSON.stringify(employee).replace(/"/g, '&quot;')})">
                            <i class="bi bi-pencil"></i>
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
    const showArchived = document.getElementById('showArchivedCheck')?.checked || false;
    
    if (!window.employeesData) return;
    
    const filteredEmployees = window.employeesData.filter(employee => {
        // Filter by archive status
        if (!showArchived && employee.archived) return false;
        
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
                                    <div class="mb-3">
                                        <label for="employeeSalary" class="form-label">Salary</label>
                                        <input type="number" class="form-control" id="employeeSalary">
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

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !role) {
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
            
            // 2. Create the profile record using force_create_profile
            console.log('Register employee: Creating profile record');
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
                salary: salary || null,
                company_id: company_id
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
            'Date Hired': new Date(employee.created_at).toLocaleDateString()
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
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
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


