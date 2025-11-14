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
  
  // State management
  const [selectedDate, setSelectedDate] = useState('');
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

  // Fetch availability when date is selected
  useEffect(() => {
    if (selectedDate && roomIds.length > 0) {
      fetchAvailability();
    } else {
      setAvailableHours([]);
      setUnavailableSlots([]);
    }
  }, [selectedDate, roomIds, fetchAvailability]);

  // Format hour
  const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
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
    setStartTime('');
    setEndTime('');
    setConflictDetails(null);
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
    
    if (!selectedDate || !startTime || !endTime) {
      setError('Please select a date, start time, and end time');
      return;
    }

    if (parseInt(startTime) >= parseInt(endTime)) {
      setError('End time must be after start time');
      return;
    }

    setSubmitting(true);
    setError(null);
    setConflictDetails(null);

    try {
      // Create datetime strings - backend will interpret in EST/EDT timezone
      // Format: YYYY-MM-DDTHH:MM:SS (no timezone, Django will use TIME_ZONE setting)
      const startDatetime = `${selectedDate}T${String(parseInt(startTime)).padStart(2, '0')}:00:00`;
      const endDatetime = `${selectedDate}T${String(parseInt(endTime)).padStart(2, '0')}:00:00`;

      const response = await createBooking({
        room_ids: roomIds,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
      });

      // Success - navigate to success page or dashboard
      alert('Booking created successfully!');
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
    // Cap at 23 (11 PM) since we can't go past midnight in the same day
    const actualMaxHour = Math.min(maxEndHour, 23);
    
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
          {/* Date Selection */}
          <div className="form-group">
            <label htmlFor="date">Select Date *</label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={handleDateChange}
              min={today}
              required
              className="form-input"
            />
          </div>

          {/* Loading State */}
          {loading && selectedDate && (
            <div className="loading-message">Loading availability...</div>
          )}

          {/* Available Hours Display */}
          {!loading && selectedDate && availableHours.length > 0 && (
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

          {/* Unavailable Slots Display */}
          {!loading && selectedDate && unavailableSlots.length > 0 && (
            <div className="unavailable-info">
              <h4>Unavailable Time Slots:</h4>
              <ul>
                {unavailableSlots.map((slot, idx) => (
                  <li key={idx}>
                    <strong>{slot.room_name}</strong>: {formatTimeString(slot.start_time)} - {formatTimeString(slot.end_time)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No Availability Message */}
          {!loading && selectedDate && availableHours.length === 0 && unavailableSlots.length > 0 && (
            <div className="no-availability">
              <p>No available hours for the selected date. Please choose another date.</p>
            </div>
          )}

          {/* Start Time Selection */}
          {selectedDate && availableHours.length > 0 && (
            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
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
            </div>
          )}

          {/* End Time Selection */}
          {startTime && (
            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
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
              disabled={submitting || !selectedDate || !startTime || !endTime}
              className="btn-primary"
            >
              {submitting ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BookingForm;

