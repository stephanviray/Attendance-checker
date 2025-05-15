// Centralized attendance status determination
const determineAttendanceStatus = (checkInTime) => {
  // Convert to Manila time
  const checkIn = new Date(checkInTime);
  const manilaTime = new Date(checkIn.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  
  const hour = manilaTime.getHours();
  const minute = manilaTime.getMinutes();

  // Default start time is 9:00 AM
  const START_HOUR = 9;
  const START_MINUTE = 0;

  // Determine if late based on time
  const isLate = (hour > START_HOUR) || (hour === START_HOUR && minute > START_MINUTE);
  
  return isLate ? 'late' : 'present';
};

// Calculate working days between two dates (excluding weekends)
const calculateWorkingDays = (startDate, endDate) => {
  let start = new Date(startDate);
  let end = new Date(endDate);
  
  // Ensure proper Date objects
  start = new Date(start.toDateString());
  end = new Date(end.toDateString());
  
  let workingDays = 0;
  let current = start;

  while (current <= end) {
    // 0 = Sunday, 6 = Saturday
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

// Calculate attendance statistics based on date hired
const calculateAttendanceStats = (dateHired, attendanceRecords) => {
  // Convert to Manila time
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const hireDate = new Date(new Date(dateHired).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  
  // Set times to midnight to ensure proper date comparison
  hireDate.setHours(0, 0, 0, 0);
    // Get yesterday in Manila time
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Add debug logging
  console.log('Date calculations:', {
    now: now.toISOString(),
    hireDate: hireDate.toISOString(),
    yesterday: yesterday.toISOString(),
  });
  
  // If hire date is after yesterday, return zero counts
  if (hireDate > yesterday) {
    return {
      totalWorkingDays: 0,
      present: 0,
      late: 0,
      absent: 0
    };
  }
  
  const totalWorkingDays = calculateWorkingDays(hireDate, yesterday);
  
  // Process attendance records
  let present = 0;
  let late = 0;
  
  // Create a map of dates with attendance
  const attendanceDates = new Map();
  attendanceRecords.forEach(record => {
    const date = new Date(record.check_in).toDateString();
    if (!attendanceDates.has(date)) {
      attendanceDates.set(date, record.status);
      if (record.status === 'present') {
        present++;
      } else if (record.status === 'late') {
        late++;
        present++; // Count late as present for total attendance
      }
    }
  });
  
  // Calculate absences (total working days minus days present)
  const absent = totalWorkingDays - present;
  
  return {
    totalWorkingDays,
    present,
    late,
    absent: Math.max(0, absent) // Ensure we don't return negative absences
  };
};

export { determineAttendanceStatus, calculateWorkingDays, calculateAttendanceStats };
