# AttendEase - Web Application

AttendEase is a modern web-based attendance management system that allows organizations to efficiently track employee attendance, manage timesheets, and generate reports.

## Features

- **User Authentication**: Secure login and registration with role-based access (Admin and Employee roles)
- **Dashboard**: Overview of attendance statistics and recent activity
- **Employee Management**: Add, edit, and delete employee profiles
- **Attendance Tracking**: Check-in and check-out functionality with timestamps
- **Reporting**: Generate and export attendance reports
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Supabase account for the backend and authentication

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/attendease.git
   cd attendease/web
   ```

2. Configure Supabase:
   - Create a Supabase project at https://supabase.com
   - Run the `supabase_schema.sql` in the SQL editor to set up the database schema
   - Update the Supabase URL and anon key in the JavaScript files:
     - `app.js`
     - `attendance.js`

3. Open the application:
   - Open `index.html` in your browser

### Configuration

Edit the Supabase configuration in `app.js` and `attendance.js`:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

## Usage

### Admin Role

- View overall attendance statistics
- Manage employees
- Track attendance for all employees
- Generate and export reports

### Employee Role

- Check in and check out
- View personal attendance history
- View attendance statistics

## Development

This project uses:

- HTML5
- CSS3
- JavaScript
- Bootstrap 5 for UI components
- Supabase for backend and authentication

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Supabase for providing the backend infrastructure
- Bootstrap for the UI framework 