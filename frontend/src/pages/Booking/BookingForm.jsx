import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { checkAvailability, createBooking } from '../../services/api';
import '../../styles/BookingPage.css';

const BookingForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get room IDs from URL params - memoize to prevent infinite loops
  const roomIdsParam = searchParams.get('rooms');
  const roomIds = useMemo(() => {
    return roomIdsParam ? roomIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
  }, [roomIdsParam]);
  
  // Get booking type from URL params
  const bookingType = searchParams.get('type') || 'regular';
  const isCampBooking = bookingType === 'camp';
  
  // State management
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState(''); // For camp bookings
  const [availableHours, setAvailableHours] = useState([]);
  const [unavailableSlots, setUnavailableSlots] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflictDetails, setConflictDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Memoize fetchAvailability to prevent recreating on every render
  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || roomIds.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await checkAvailability(selectedDate, roomIds);
      setAvailableHours(response.data.available_hours || []);
      setUnavailableSlots(response.data.unavailable_slots || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch availability');
      setAvailableHours([]);
      setUnavailableSlots([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, roomIds]);

  // Fetch availability when date is selected (only for regular bookings)
  useEffect(() => {
    if (!isCampBooking && selectedDate && roomIds.length > 0) {
      fetchAvailability();
    } else {
      setAvailableHours([]);
      setUnavailableSlots([]);
    }
  }, [selectedDate, roomIds, fetchAvailability, isCampBooking]);

  // Format hour
  const formatHour = (hour) => {
    // Handle hour 24 (midnight/12am)
    if (hour === 24 || hour === 0) {
      return '12:00 AM';
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  // Format time from string (for unavailable slots)
  const formatTimeString = (timeStr) => {
    // If it's already formatted, return as is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      return timeStr;
    }
    return timeStr;
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    if (isCampBooking) {
      // For camp bookings, set end date to same as start date initially
      setSelectedEndDate(e.target.value);
    }
    setStartTime('');
    setEndTime('');
    setConflictDetails(null);
  };

  const handleEndDateChange = (e) => {
    setSelectedEndDate(e.target.value);
    setConflictDetails(null);
  };

  const handleDateInputClick = (e) => {
    // Focus the input to open the calendar
    e.target.focus();
    // Try to show the native picker if available (only works on non-readonly inputs)
    if (e.target.showPicker && !e.target.readOnly) {
      try {
        e.target.showPicker();
      } catch (err) {
        // If showPicker fails, focus is enough to open calendar in most browsers
        console.log('showPicker not available, using focus');
      }
    }
  };

  const handleDateKeyDown = (e) => {
    // Prevent typing - only allow navigation keys
    if (!['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
    // Reset end time if it's before start time
    if (endTime && parseInt(e.target.value) >= parseInt(endTime)) {
      setEndTime('');
    }
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isCampBooking) {
      // Camp booking validation
      if (!selectedDate || !selectedEndDate || !startTime || !endTime) {
        setError('Please select start date, end date, start time, and end time');
        return;
      }
      
      // For camp bookings, validate dates
      const startDateObj = new Date(selectedDate);
      const endDateObj = new Date(selectedEndDate);
      
      if (endDateObj < startDateObj) {
        setError('End date must be on or after start date');
        return;
      }
      
      // If same day, validate times
      if (selectedDate === selectedEndDate && parseInt(startTime) >= parseInt(endTime)) {
        setError('End time must be after start time');
        return;
      }
    } else {
      // Regular booking validation
      if (!selectedDate || !startTime || !endTime) {
        setError('Please select a date, start time, and end time');
        return;
      }

      if (parseInt(startTime) >= parseInt(endTime)) {
        setError('End time must be after start time');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setConflictDetails(null);

    try {
      // Create datetime strings - backend will interpret in EST/EDT timezone
      // Format: YYYY-MM-DDTHH:MM:SS (no timezone, Django will use TIME_ZONE setting)
      let startHour = parseInt(startTime);
      let endHour = parseInt(endTime);
      
      let startDate = selectedDate;
      let endDate = isCampBooking ? selectedEndDate : selectedDate;
      
      // Handle hour 24 (midnight) - convert to next day at 00:00
      if (endHour === 24) {
        endHour = 0;
        // Add one day to the end date
        const date = new Date(endDate);
        date.setDate(date.getDate() + 1);
        endDate = date.toISOString().split('T')[0];
      }
      
      const startDatetime = `${startDate}T${String(startHour).padStart(2, '0')}:00:00`;
      const endDatetime = `${endDate}T${String(endHour).padStart(2, '0')}:00:00`;

      const response = await createBooking({
        room_ids: roomIds,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        booking_type: isCampBooking ? 'camp' : 'regular',
      });

      // Success - navigate to success page or dashboard
      alert(isCampBooking ? 'Camp booking created successfully! It will be reviewed by an admin.' : 'Booking created successfully!');
      navigate('/bookingpage');
    } catch (err) {
      if (err.response?.status === 409) {
        // Conflict error
        setConflictDetails(err.response.data);
        setError(err.response.data.detail || 'Booking conflict detected');
      } else {
        setError(err.response?.data?.detail || 'Failed to create booking');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Generate time options from available hours
  const generateTimeOptions = () => {
    if (availableHours.length === 0) return [];
    const allHours = availableHours;
    const options = [];
    
    // Add start time options
    for (let i = 0; i < allHours.length; i++) {
      options.push({
        value: allHours[i],
        label: formatHour(allHours[i]),
        type: 'start'
      });
    }
    
    return options;
  };

  const timeOptions = generateTimeOptions();
  
  // Generate end time options - only until next booking or midnight
  const getEndTimeOptions = () => {
    if (!startTime) return [];
    
    const startHour = parseInt(startTime);
    const options = [];
    
    // Find the earliest next booking after start time across all selected rooms
    let maxEndHour = 24; // Default to midnight (24 = 12:00 AM next day)
    
    // Check unavailable slots to find the next booking that starts after our start time
    // We need to check all rooms in roomIds to find the earliest conflict
    for (const slot of unavailableSlots) {
      // Only check slots for rooms we're trying to book
      if (roomIds.includes(slot.room_id)) {
        const slotStartHour = slot.start_hour;
        
        // If this booking starts after our start time, limit end time to this booking's start
        if (slotStartHour !== undefined && slotStartHour > startHour && slotStartHour < maxEndHour) {
          maxEndHour = slotStartHour;
        }
      }
    }
    
    // Generate options from startHour + 1 to maxEndHour (inclusive)
    // Allow up to 24 (12:00 AM) as end time
    const actualMaxHour = Math.min(maxEndHour, 24);
    
    for (let hour = startHour + 1; hour <= actualMaxHour; hour++) {
      options.push({
        value: hour,
        label: formatHour(hour)
      });
    }
    
    return options;
  };

  const endTimeOptions = getEndTimeOptions();

  return (
    <div className="booking-form-container">
      <h2>Complete Your Booking</h2>
      
      {roomIds.length === 0 && (
        <div className="error-message">
          No rooms selected. Please go back and select rooms first.
          <button onClick={() => navigate('/bookingpage')} className="btn-secondary">
            Select Rooms
          </button>
        </div>
      )}

      {roomIds.length > 0 && (
        <form onSubmit={handleSubmit} className="booking-form">
          {isCampBooking && (
            <div className="camp-booking-notice" style={{ 
              backgroundColor: '#e8edf5', 
              padding: '15px', 
              borderRadius: '5px', 
              marginBottom: '20px',
              border: '2px solid #1a3970'
            }}>
              <strong>Camp Booking:</strong> This booking will require admin approval. You can select different start and end dates.
            </div>
          )}
          
          {/* Date Selection */}
          <div className="form-group">
            <label htmlFor="date">{isCampBooking ? 'Start Date *' : 'Select Date *'}</label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={handleDateChange}
              onKeyDown={handleDateKeyDown}
              onKeyPress={(e) => e.preventDefault()}
              min={today}
              required
              className="form-input date-input"
              onClick={handleDateInputClick}
            />
          </div>

          {/* End Date Selection for Camp Bookings */}
          {isCampBooking && (
            <div className="form-group">
              <label htmlFor="endDate">End Date *</label>
              <input
                type="date"
                id="endDate"
                value={selectedEndDate}
                onChange={handleEndDateChange}
                onKeyDown={handleDateKeyDown}
                onKeyPress={(e) => e.preventDefault()}
                min={selectedDate || today}
                required
                className="form-input date-input"
                onClick={handleDateInputClick}
              />
            </div>
          )}

          {/* Loading State - only show for regular bookings */}
          {!isCampBooking && loading && selectedDate && (
            <div className="loading-message">Loading availability...</div>
          )}

          {/* Available Hours Display - only for regular bookings */}
          {!isCampBooking && !loading && selectedDate && availableHours.length > 0 && (
            <div className="availability-info">
              <h3>Available Hours for {new Date(selectedDate).toLocaleDateString()}</h3>
              <div className="available-hours">
                {availableHours.map(hour => (
                  <span key={hour} className="hour-badge available">
                    {formatHour(hour)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable Slots Display - only for regular bookings */}
          {!isCampBooking && !loading && selectedDate && unavailableSlots.length > 0 && (
            <div className="unavailable-info">
              <h4>Unavailable Time Slots:</h4>
              <ul>
                {[...unavailableSlots]
                  .sort((a, b) => {
                    // Sort by start_hour if available, otherwise by start_datetime
                    if (a.start_hour !== undefined && b.start_hour !== undefined) {
                      return a.start_hour - b.start_hour;
                    }
                    // Fallback to datetime string comparison
                    const aTime = a.start_datetime || a.start_time || '';
                    const bTime = b.start_datetime || b.start_time || '';
                    return aTime.localeCompare(bTime);
                  })
                  .map((slot, idx) => (
                    <li key={idx}>
                      <strong>{slot.room_name}</strong>: {formatTimeString(slot.start_time)} - {formatTimeString(slot.end_time)}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* No Availability Message - only for regular bookings */}
          {!isCampBooking && !loading && selectedDate && availableHours.length === 0 && unavailableSlots.length > 0 && (
            <div className="no-availability">
              <p>No available hours for the selected date. Please choose another date.</p>
            </div>
          )}

          {/* Start Time Selection */}
          {selectedDate && (isCampBooking || availableHours.length > 0) && (
            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
              {isCampBooking ? (
                <select
                  id="startTime"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  required
                  className="form-input"
                >
                  <option value="">Select start time</option>
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id="startTime"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  required
                  className="form-input"
                >
                  <option value="">Select start time</option>
                  {timeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* End Time Selection */}
          {startTime && (isCampBooking || true) && (
            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
              {isCampBooking ? (
                <select
                  id="endTime"
                  value={endTime}
                  onChange={handleEndTimeChange}
                  required
                  className="form-input"
                >
                  <option value="">Select end time</option>
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id="endTime"
                  value={endTime}
                  onChange={handleEndTimeChange}
                  required
                  className="form-input"
                >
                  <option value="">Select end time</option>
                  {endTimeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Conflict Details */}
          {conflictDetails && conflictDetails.conflicts && (
            <div className="conflict-details">
              <h4>Booking Conflicts Detected:</h4>
              <ul>
                {conflictDetails.conflicts.map((conflict, idx) => (
                  <li key={idx}>
                    <strong>{conflict.room}</strong> is already booked from{' '}
                    {new Date(conflict.start).toLocaleString()} to{' '}
                    {new Date(conflict.end).toLocaleString()}
                  </li>
                ))}
              </ul>
              <p>Please select a different time slot.</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/bookingpage')}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedDate || !startTime || !endTime || (isCampBooking && !selectedEndDate)}
              className="btn-primary"
            >
              {submitting ? 'Creating Booking...' : isCampBooking ? 'Submit Camp Booking' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BookingForm;

