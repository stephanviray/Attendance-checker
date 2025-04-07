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

// Initialize the app
async function initializeApp() {
    console.log("Initializing application");
    
    // Initialize Bootstrap components
    initializeBootstrapComponents();
    
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
        
        // Check if profiles table exists before trying to query it
        try {
            const { count, error: countError } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true });
                
            if (countError && countError.code === '42P01') {
                console.warn("Profiles table doesn't exist yet, skipping profile fetch");
                return; // Skip trying to fetch profile
            }
        } catch (tableCheckError) {
            console.error("Error checking profiles table:", tableCheckError);
            // Continue anyway
        }
        
        // Try to get user profile from database
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (error) {
                console.error("Error fetching user profile:", error);
                // Don't show error toast since we already have localStorage data
                return;
            }
            
            if (profile) {
                console.log("User profile loaded from database:", profile);
                
                // Update UI with profile data
                updateUIWithUserData(profile);
                
                // Update localStorage with the latest profile data
                currentUser = {...currentUser, ...profile};
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                console.warn("User profile not found in database");
            }
        } catch (profileError) {
            console.error("Exception fetching user profile:", profileError);
            // Continue with localStorage data
        }
    } catch (err) {
        console.error("Error in loadUserData function:", err);
        // Continue with localStorage data if available, don't show error toast
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
        
        // Fetch attendance records
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
                    custom_id
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
        
        if (!attendanceRecords || attendanceRecords.length === 0) {
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
        const attendanceHTML = attendanceRecords.map(record => {
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
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 class="mb-0">List of Employees</h1>
                    <p class="text-muted mb-0">Manage your company's employees</p>
                </div>
                <div class="d-flex gap-2 employees-toolbar">
                    <input type="text" class="form-control form-control-sm" id="employeeSearch" placeholder="Search employees...">
                    <select class="form-select form-select-sm" id="departmentFilter">
                        <option value="">All Departments</option>
                    </select>
                    <button class="btn btn-primary btn-sm" id="refreshEmployeesBtn">
                        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Employee Stats Cards -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title mb-0">Total Employees</h6>
                                    <h2 class="mb-0" id="totalEmployees">-</h2>
                                </div>
                                <div class="fs-1">
                                    <i class="bi bi-people"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-info text-white">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title mb-0">Departments</h6>
                                    <h2 class="mb-0" id="totalDepartments">-</h2>
                                </div>
                                <div class="fs-1">
                                    <i class="bi bi-building"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0">Employee Directory</h5>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Name</th>
                                    <th>Employee ID</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                    <th>Position</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="employeesList">
                                <tr>
                                    <td colspan="6" class="text-center py-4">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
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
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchEmployeesList());
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', filterEmployees);
    }
    
    if (departmentFilter) {
        departmentFilter.addEventListener('change', filterEmployees);
    }
    
    // Load employees data
    fetchEmployeesList();
}

// Fetch employee list from Supabase
async function fetchEmployeesList() {
    console.log('Starting fetchEmployeesList with Supabase URL:', supabaseClient.supabaseUrl);
    
    try {
        // Show loading state
        const employeesList = document.getElementById('employeesList');
        if (!employeesList) {
            console.error('Employees list element not found');
            return;
        }
        
        employeesList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading employees...</p>
                </td>
            </tr>
        `;
        
        // Test basic connectivity to Supabase
        try {
            const { data: healthData, error: healthError } = await supabaseClient.rpc('get_service_role');
            console.log('Supabase health check:', { healthData, healthError });
        } catch (healthCheckError) {
            console.error('Supabase health check failed:', healthCheckError);
        }
        
        // Simple query to check if profiles table exists
        try {
            console.log('Checking if profiles table exists...');
            const { count, error: countError } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            
            console.log('Total profiles count:', count);
            
            if (countError) {
                console.error('Error checking profiles count:', countError);
                // Continue execution, don't return here
            }
        } catch (tableCheckError) {
            console.error('Error checking if profiles table exists:', tableCheckError);
        }
        
        // Get current user's company_id
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.id) {
            console.error('No user data found in localStorage');
            employeesList.innerHTML = `
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
        
        console.log('Current user ID:', currentUser.id);
        
        // First get the company_id from the user's profile
        const { data: userProfile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        console.log('User profile:', userProfile);
            
        if (profileError) {
            console.error('Error fetching user profile:', profileError);
            employeesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Error: ${profileError.message}
                            <br>
                            <small>Code: ${profileError.code}, Details: ${JSON.stringify(profileError.details || {})}</small>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        if (!userProfile) {
            console.error('No profile found for user');
            employeesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            No profile found. Please contact support.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // If user is not a company, show error
        if (userProfile.role !== 'company') {
            console.error('User is not a company');
            employeesList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Only company accounts can view employee lists
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // If company_id is not set, update it to the user's ID
        if (!userProfile.company_id) {
            console.log('Setting company_id to user ID:', currentUser.id);
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ company_id: currentUser.id })
                .eq('id', currentUser.id);
                
            if (updateError) {
                console.error('Error updating company_id:', updateError);
                employeesList.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                Error: ${updateError.message}
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Set company_id to user's ID after successful update
            userProfile.company_id = currentUser.id;
        }
        
        console.log('Fetching employees with role=employee...');
        
        try {
            // Fetch all employees with role=employee
            const { data: employeeProfiles, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('role', 'employee')
                .order('full_name');
                
            console.log('Employee profiles query result:', { employeeProfiles, error });
            
            // Log the raw SQL query for debugging
            console.log('Raw SQL Query:', `
                SELECT * FROM profiles 
                WHERE role = 'employee' 
                ORDER BY full_name
            `);
                
            // Handle any errors
            if (error) {
                console.error('Error fetching employee profiles:', error);
                employeesList.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                Error: ${error.message}
                                <br>
                                <small>Code: ${error.code}, Details: ${JSON.stringify(error.details || {})}</small>
                                <br><br>
                                <strong>Try running this SQL in Supabase SQL Editor:</strong>
                                <pre>
CREATE POLICY "Allow anon access for testing"
ON profiles FOR ALL
TO anon
USING (true)
WITH CHECK (true);
                                </pre>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Store data for filtering
            window.employeesData = employeeProfiles || [];
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
                            <p>To fix this, go to your Supabase dashboard:</p>
                            <ol>
                                <li>Navigate to the Authentication > Policies section</li>
                                <li>Find the 'profiles' table</li>
                                <li>Enable a policy for 'SELECT' or create a new policy like: <code>((role = 'company' AND auth.uid() = company_id) OR auth.uid() = id)</code></li>
                            </ol>
                            <p>This will allow company accounts to view their employees.</p>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    console.log(`Displaying ${employees.length} employees`);
    
    // Create the HTML for each employee
    const employeesHTML = employees.map(employee => {
        console.log('Processing employee:', employee);
        return `
            <tr data-employee-id="${employee.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar me-2">
                            <span class="avatar-initials">${getInitials(employee.full_name)}</span>
                        </div>
                        <div>
                            <div class="fw-bold">${employee.full_name || 'N/A'}</div>
                            <small class="text-muted">${employee.position || 'No position'}</small>
                        </div>
                    </div>
                </td>
                <td>${employee.custom_id || 'N/A'}</td>
                <td>${employee.email || 'N/A'}</td>
                <td>${employee.department || 'N/A'}</td>
                <td>${employee.position || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-employee-btn" data-employee-id="${employee.id}">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-employee-btn ms-1" data-employee-id="${employee.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('Generated HTML:', employeesHTML);
    
    // Update the table
    employeesList.innerHTML = employeesHTML;
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-employee-btn').forEach(button => {
        button.addEventListener('click', function() {
            const employeeId = this.getAttribute('data-employee-id');
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee) {
                showEditEmployeeModal(employee);
            }
        });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-employee-btn').forEach(button => {
        button.addEventListener('click', function() {
            const employeeId = this.getAttribute('data-employee-id');
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee) {
                if (confirm(`Are you sure you want to delete ${employee.full_name}?`)) {
                    deleteEmployee(employeeId);
                }
            }
        });
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

// Update employee stats
function updateEmployeeStats(employees) {
    // Update total employees count
    const totalEmployeesElement = document.getElementById('totalEmployees');
    if (totalEmployeesElement) {
        totalEmployeesElement.textContent = employees.length;
    }
    
    // Update departments count
    const departments = new Set(employees.map(emp => emp.department).filter(Boolean));
    const totalDepartmentsElement = document.getElementById('totalDepartments');
    if (totalDepartmentsElement) {
        totalDepartmentsElement.textContent = departments.size;
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
    let options = '<option value="">All Departments</option>';
    departments.forEach(dept => {
        options += `<option value="${dept}">${dept}</option>`;
    });
    
    // Add options to select
    departmentFilter.innerHTML = options;
}

// Filter employees based on search and department
function filterEmployees() {
    if (!window.employeesData) return;
    
    const searchInput = document.getElementById('employeeSearch');
    const departmentFilter = document.getElementById('departmentFilter');
    
    if (!searchInput || !departmentFilter) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const departmentTerm = departmentFilter.value;
    
    // Filter data
    const filteredData = window.employeesData.filter(employee => {
        // Search matching
        const matchesSearch = !searchTerm || 
            (employee.full_name && employee.full_name.toLowerCase().includes(searchTerm)) ||
            (employee.email && employee.email.toLowerCase().includes(searchTerm)) ||
            (employee.custom_id && employee.custom_id.toLowerCase().includes(searchTerm)) ||
            (employee.position && employee.position.toLowerCase().includes(searchTerm));
            
        // Department matching
        const matchesDepartment = !departmentTerm || 
            (employee.department === departmentTerm) ||
            (!employee.department && departmentTerm === 'Unassigned');
            
        return matchesSearch && matchesDepartment;
    });
    
    // Update display
    displayEmployees(filteredData);
    
    // Update stats for filtered data
    const totalEmployeesEl = document.getElementById('totalEmployees');
    if (totalEmployeesEl) {
        totalEmployeesEl.textContent = filteredData.length;
    }
}

// Function to show edit employee modal
function showEditEmployeeModal(employee) {
    // Create modal if it doesn't exist
    if (!document.getElementById('editEmployeeModal')) {
        const modalHTML = `
            <div class="modal fade" id="editEmployeeModal" tabindex="-1" aria-labelledby="editEmployeeModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editEmployeeModalLabel">Edit Employee</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editEmployeeForm">
                                <input type="hidden" id="editEmployeeId">
                                
                                <div class="mb-3">
                                    <label for="editEmployeeName" class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="editEmployeeName" disabled>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeeEmail" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="editEmployeeEmail" disabled>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeeDepartment" class="form-label">Department</label>
                                    <input type="text" class="form-control" id="editEmployeeDepartment" placeholder="Enter department">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="editEmployeePosition" class="form-label">Position</label>
                                    <input type="text" class="form-control" id="editEmployeePosition" placeholder="Enter position">
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
    
    // Populate modal with employee data
    document.getElementById('editEmployeeId').value = employee.id;
    document.getElementById('editEmployeeName').value = employee.full_name || '';
    document.getElementById('editEmployeeEmail').value = employee.email || '';
    document.getElementById('editEmployeeDepartment').value = employee.department || '';
    document.getElementById('editEmployeePosition').value = employee.position || '';
    
    // Hide any previous alerts
    document.getElementById('editSuccessAlert').classList.add('d-none');
    document.getElementById('editErrorAlert').classList.add('d-none');
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('editEmployeeModal'));
    modal.show();
}

// Function to save employee changes
async function saveEmployeeChanges() {
    // Get data from form
    const employeeId = document.getElementById('editEmployeeId').value;
    const department = document.getElementById('editEmployeeDepartment').value.trim();
    const position = document.getElementById('editEmployeePosition').value.trim();
    
    // Show loading state
    const saveBtn = document.getElementById('saveEmployeeBtn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    saveBtn.disabled = true;
    
    try {
        // Update employee in Supabase
        const { data, error } = await supabaseClient
            .from('profiles')
            .update({
                department,
                position,
                updated_at: new Date().toISOString()
            })
            .eq('id', employeeId);
        
        // Handle error
        if (error) {
            console.error('Error updating employee:', error);
            const errorAlert = document.getElementById('editErrorAlert');
            errorAlert.textContent = `Error: ${error.message}`;
            errorAlert.classList.remove('d-none');
            return;
        }
        
        // Show success message
        document.getElementById('editSuccessAlert').classList.remove('d-none');
        
        // Update in local data
        if (window.employeesData) {
            const empIndex = window.employeesData.findIndex(emp => emp.id === employeeId);
            if (empIndex !== -1) {
                window.employeesData[empIndex].department = department;
                window.employeesData[empIndex].position = position;
                
                // Refresh the display
                displayEmployees(window.employeesData);
                
                // Update stats and filters
                updateEmployeeStats(window.employeesData);
                populateDepartmentFilter(window.employeesData);
            }
        }
        
        // Close modal after 1 second
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal'));
            if (modal) {
                modal.hide();
            }
        }, 1000);
    } catch (err) {
        console.error('Exception updating employee:', err);
        const errorAlert = document.getElementById('editErrorAlert');
        errorAlert.textContent = `Exception: ${err.message}`;
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


