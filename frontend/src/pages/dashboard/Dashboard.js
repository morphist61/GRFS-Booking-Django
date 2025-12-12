import React, { useEffect, useState, useCallback } from 'react';
import { getMyBookings, deleteBooking, updateBooking, checkAvailability } from '../../services/api';
import '../../styles/Dashboard.css';

const Dashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPastBookings, setShowPastBookings] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editAvailableHours, setEditAvailableHours] = useState([]);
  const [editUnavailableSlots, setEditUnavailableSlots] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchEditAvailability = useCallback(async (date, roomIds) => {
    if (!date || roomIds.length === 0) return;
    
    setEditLoading(true);
    try {
      const response = await checkAvailability(date, roomIds);
      setEditAvailableHours(response.data.available_hours || []);
      setEditUnavailableSlots(response.data.unavailable_slots || []);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      setEditAvailableHours([]);
      setEditUnavailableSlots([]);
    } finally {
      setEditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (editingBooking && editForm.selectedDate && editForm.room_ids) {
      fetchEditAvailability(editForm.selectedDate, editForm.room_ids);
    }
  }, [editingBooking, editForm.selectedDate, editForm.room_ids, fetchEditAvailability]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await getMyBookings();
      setBookings(response.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      await deleteBooking(bookingId);
      // Remove the booking from the list immediately
      setBookings(prevBookings => prevBookings.filter(b => b.id !== bookingId));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel booking');
    }
  };

  const formatHour = (hour) => {
    if (hour === 24 || hour === 0) {
      return '12:00 AM';
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const handleEdit = async (booking) => {
    setEditingBooking(booking.id);
    const startDate = booking.start_datetime ? new Date(booking.start_datetime).toISOString().split('T')[0] : '';
    // Get hours in EST/EDT timezone
    const startDateObj = booking.start_datetime ? new Date(booking.start_datetime) : null;
    const endDateObj = booking.end_datetime ? new Date(booking.end_datetime) : null;
    
    // Convert to EST/EDT hours (getHours() returns local time, but we need to extract the hour from the datetime string)
    let startHour = '';
    let endHour = '';
    
    if (startDateObj) {
      // Extract hour from the datetime string (format: YYYY-MM-DDTHH:MM:SS)
      const startDateTimeStr = booking.start_datetime;
      if (startDateTimeStr) {
        const hourMatch = startDateTimeStr.match(/T(\d{2}):/);
        if (hourMatch) {
          startHour = parseInt(hourMatch[1]).toString();
        }
      }
    }
    
    if (endDateObj) {
      const endDateTimeStr = booking.end_datetime;
      if (endDateTimeStr) {
        const hourMatch = endDateTimeStr.match(/T(\d{2}):/);
        if (hourMatch) {
          endHour = parseInt(hourMatch[1]).toString();
        }
      }
    }
    
    const roomIds = booking.rooms.map(room => room.id);
    
    setEditForm({
      selectedDate: startDate,
      startTime: startHour,
      endTime: endHour,
      room_ids: roomIds,
    });
    
    // Fetch availability for the booking date
    if (startDate) {
      await fetchEditAvailability(startDate, roomIds);
    }
  };

  const handleEditDateChange = (e) => {
    const newDate = e.target.value;
    setEditForm({...editForm, selectedDate: newDate, startTime: '', endTime: ''});
    if (newDate && editForm.room_ids) {
      fetchEditAvailability(newDate, editForm.room_ids);
    }
  };

  const getEndTimeOptions = (startHour, unavailableSlots, roomIds) => {
    if (!startHour) return [];
    
    const startHourInt = parseInt(startHour);
    const options = [];
    let maxEndHour = 24;
    
    for (const slot of unavailableSlots) {
      if (roomIds.includes(slot.room_id)) {
        const slotStartHour = slot.start_hour;
        if (slotStartHour !== undefined && slotStartHour > startHourInt && slotStartHour < maxEndHour) {
          maxEndHour = slotStartHour;
        }
      }
    }
    
    const actualMaxHour = Math.min(maxEndHour, 24);
    for (let hour = startHourInt + 1; hour <= actualMaxHour; hour++) {
      options.push({
        value: hour,
        label: formatHour(hour)
      });
    }
    
    return options;
  };

  const handleUpdate = async (bookingId) => {
    if (!editForm.selectedDate || !editForm.startTime || !editForm.endTime) {
      alert('Please select a date, start time, and end time');
      return;
    }

    if (parseInt(editForm.startTime) >= parseInt(editForm.endTime)) {
      alert('End time must be after start time');
      return;
    }

    try {
      // Format datetime strings like BookingForm does
      let startHour = parseInt(editForm.startTime);
      let endHour = parseInt(editForm.endTime);
      
      let endDate = editForm.selectedDate;
      if (endHour === 24) {
        endHour = 0;
        const date = new Date(editForm.selectedDate);
        date.setDate(date.getDate() + 1);
        endDate = date.toISOString().split('T')[0];
      }
      
      const startDatetime = `${editForm.selectedDate}T${String(startHour).padStart(2, '0')}:00:00`;
      const endDatetime = `${endDate}T${String(endHour).padStart(2, '0')}:00:00`;

      await updateBooking(bookingId, {
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        room_ids: editForm.room_ids,
      });
      setEditingBooking(null);
      setEditForm({});
      setEditAvailableHours([]);
      setEditUnavailableSlots([]);
      fetchBookings(); // Refresh the list
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update booking');
    }
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setEditForm({});
    setEditAvailableHours([]);
    setEditUnavailableSlots([]);
  };

  const formatDate = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isPastBooking = (booking) => {
    if (!booking.end_datetime) return false;
    return new Date(booking.end_datetime) < new Date();
  };

  // Filter out cancelled bookings and separate current from past
  const activeBookings = bookings.filter(b => b.status !== 'Cancelled');
  const currentBookings = activeBookings.filter(b => !isPastBooking(b));
  const pastBookings = activeBookings.filter(b => isPastBooking(b));

  if (loading) {
    return <div className="dashboard-container"><div className="loading">Loading bookings...</div></div>;
  }

  return (
    <div className="dashboard-container">
      <h1>My Bookings</h1>
      
      {error && <div className="error-message">{error}</div>}

      {/* Current/Upcoming Bookings */}
      <div className="bookings-section">
        {currentBookings.length === 0 ? (
          <p className="no-bookings">No upcoming bookings.</p>
        ) : (
          <div className="bookings-list">
            {currentBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                {editingBooking === booking.id ? (
                  <div className="edit-form">
                    <h3>Edit Booking</h3>
                    <div className="form-group">
                      <label>Select Date *</label>
                      <input
                        type="date"
                        value={editForm.selectedDate || ''}
                        onChange={handleEditDateChange}
                        onKeyDown={(e) => {
                          if (!['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onKeyPress={(e) => e.preventDefault()}
                        min={new Date().toISOString().split('T')[0]}
                        required
                        className="form-input date-input"
                        onClick={(e) => {
                          e.target.focus();
                          if (e.target.showPicker && !e.target.readOnly) {
                            try {
                              e.target.showPicker();
                            } catch (err) {
                              console.log('showPicker not available');
                            }
                          }
                        }}
                      />
                    </div>
                    {editLoading && editForm.selectedDate && (
                      <div className="loading-message">Loading availability...</div>
                    )}
                    {editForm.selectedDate && editAvailableHours.length > 0 && (
                      <div className="form-group">
                        <label>Start Time *</label>
                        <select
                          value={editForm.startTime || ''}
                          onChange={(e) => {
                            setEditForm({...editForm, startTime: e.target.value, endTime: ''});
                          }}
                          required
                          className="form-input"
                        >
                          <option value="">Select start time</option>
                          {editAvailableHours.map(hour => (
                            <option key={hour} value={hour}>
                              {formatHour(hour)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {editForm.startTime && (
                      <div className="form-group">
                        <label>End Time *</label>
                        <select
                          value={editForm.endTime || ''}
                          onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                          required
                          className="form-input"
                        >
                          <option value="">Select end time</option>
                          {getEndTimeOptions(editForm.startTime, editUnavailableSlots, editForm.room_ids || []).map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-actions">
                      <button onClick={() => handleUpdate(booking.id)} className="btn-save">Save</button>
                      <button onClick={handleCancelEdit} className="btn-cancel">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="booking-card-content">
                    <div className="booking-info">
                    <div className="booking-top-row">
                      <div className="left-side">
                        <h3>{booking.rooms.map(r => r.name).join(', ')}</h3>
                        <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="right-side">
                        <button onClick={() => handleEdit(booking)} className="btn-edit">Edit</button>
                        <button onClick={() => handleDelete(booking.id)} className="btn-delete">Delete</button>
                      </div>
                    </div>
                      <div className="booking-details-compact">
                        <div className="detail-item-compact">
                          <strong>Date:</strong>
                          <span>{formatDate(booking.start_datetime)}</span>
                        </div>
                        <div className="detail-item-compact">
                          <strong>Start:</strong>
                          <span>{formatTime(booking.start_datetime)}</span>
                        </div>
                        <div className="detail-item-compact">
                          <strong>End:</strong>
                          <span>{formatTime(booking.end_datetime)}</span>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Bookings */}
      {pastBookings.length > 0 && (
        <div className="bookings-section">
          <button 
            className="toggle-past-btn"
            onClick={() => setShowPastBookings(!showPastBookings)}
          >
            {showPastBookings ? 'Hide' : 'Show'} Past Bookings ({pastBookings.length})
          </button>
          
          {showPastBookings && (
            <div className="bookings-list">
              {pastBookings.map((booking) => (
                <div key={booking.id} className="booking-card past-booking">
                  <div className="booking-card-content">
                    <div className="booking-info">
                      <div className="booking-header-compact">
                        <h3>{booking.rooms.map(r => r.name).join(', ')}</h3>
                        <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="booking-details-compact">
                        <div className="detail-item-compact">
                          <strong>Date:</strong>
                          <span>{formatDate(booking.start_datetime)}</span>
                        </div>
                        <div className="detail-item-compact">
                          <strong>Start:</strong>
                          <span>{formatTime(booking.start_datetime)}</span>
                        </div>
                        <div className="detail-item-compact">
                          <strong>End:</strong>
                          <span>{formatTime(booking.end_datetime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
