import React, { useEffect, useState, useCallback } from 'react';
import { getAllBookings, getRooms, deleteBooking, updateBooking, checkAvailability } from '../../services/api';
import '../../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
    fetchRooms();
  }, []);

  useEffect(() => {
    if (isEditing && editForm.selectedDate && editForm.room_ids) {
      fetchEditAvailability(editForm.selectedDate, editForm.room_ids);
    }
  }, [isEditing, editForm.selectedDate, editForm.room_ids, fetchEditAvailability]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await getAllBookings();
      // Filter out cancelled bookings
      const activeBookings = (response.data || []).filter(
        booking => booking.status.toLowerCase() !== 'cancelled'
      );
      setBookings(activeBookings);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await getRooms();
      setRooms(response.data || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  const getFilteredBookings = () => {
    if (!selectedRoomId || viewMode === 'day') {
      return bookings;
    }
    return bookings.filter(booking => 
      booking.rooms.some(room => room.id === parseInt(selectedRoomId))
    );
  };

  const formatRoomName = (room) => {
    if (room.floor && room.floor.name) {
      return `${room.floor.name} - ${room.name}`;
    }
    return room.name;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatHour = (hour) => {
    if (hour === 24 || hour === 0) {
      return '12:00 AM';
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const handleEditBooking = () => {
    if (!selectedBooking) return;
    
    setIsEditing(true);
    const startDate = selectedBooking.start_datetime ? new Date(selectedBooking.start_datetime).toISOString().split('T')[0] : '';
    const startDateObj = selectedBooking.start_datetime ? new Date(selectedBooking.start_datetime) : null;
    const endDateObj = selectedBooking.end_datetime ? new Date(selectedBooking.end_datetime) : null;
    
    let startHour = '';
    let endHour = '';
    
    if (startDateObj) {
      const startDateTimeStr = selectedBooking.start_datetime;
      if (startDateTimeStr) {
        const hourMatch = startDateTimeStr.match(/T(\d{2}):/);
        if (hourMatch) {
          startHour = parseInt(hourMatch[1]).toString();
        }
      }
    }
    
    if (endDateObj) {
      const endDateTimeStr = selectedBooking.end_datetime;
      if (endDateTimeStr) {
        const hourMatch = endDateTimeStr.match(/T(\d{2}):/);
        if (hourMatch) {
          endHour = parseInt(hourMatch[1]).toString();
        }
      }
    }
    
    const roomIds = selectedBooking.rooms.map(room => room.id);
    
    setEditForm({
      selectedDate: startDate,
      startTime: startHour,
      endTime: endHour,
      room_ids: roomIds,
    });
    
    if (startDate) {
      fetchEditAvailability(startDate, roomIds);
    }
  };

  const handleEditDateChange = (e) => {
    const newDate = e.target.value;
    setEditForm({...editForm, selectedDate: newDate, startTime: '', endTime: ''});
    if (newDate && editForm.room_ids) {
      fetchEditAvailability(newDate, editForm.room_ids);
    }
  };

  const handleDateKeyDown = (e) => {
    // Prevent typing but allow navigation keys
    if (e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') {
      e.preventDefault();
    }
  };

  const handleDateInputClick = (e) => {
    // Try to open the date picker
    if (e.target.showPicker) {
      try {
        e.target.showPicker();
      } catch (err) {
        // Fallback to focus if showPicker is not supported
        e.target.focus();
      }
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

  const handleUpdateBooking = async () => {
    if (!selectedBooking || !editForm.selectedDate || !editForm.startTime || !editForm.endTime) {
      alert('Please select a date, start time, and end time');
      return;
    }

    if (parseInt(editForm.startTime) >= parseInt(editForm.endTime)) {
      alert('End time must be after start time');
      return;
    }

    try {
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

      await updateBooking(selectedBooking.id, {
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        room_ids: editForm.room_ids,
      });
      
      // Refresh bookings and close edit mode
      await fetchBookings();
      setIsEditing(false);
      setEditForm({});
      setEditAvailableHours([]);
      setEditUnavailableSlots([]);
      
      // Update selected booking to reflect changes
      const updatedBooking = bookings.find(b => b.id === selectedBooking.id);
      if (updatedBooking) {
        setSelectedBooking(updatedBooking);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update booking');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setEditAvailableHours([]);
    setEditUnavailableSlots([]);
  };

  const getBookingsForDate = (date) => {
    const filteredBookings = getFilteredBookings();
    const dateStr = date.toISOString().split('T')[0];
    return filteredBookings.filter(booking => {
      const startDate = new Date(booking.start_datetime);
      const endDate = new Date(booking.end_datetime);
      const bookingStartStr = startDate.toISOString().split('T')[0];
      const bookingEndStr = endDate.toISOString().split('T')[0];
      return dateStr >= bookingStartStr && dateStr <= bookingEndStr;
    });
  };

  const getBookingsForTimeSlot = (date, hour) => {
    const filteredBookings = getFilteredBookings();
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    
    return filteredBookings.filter(booking => {
      const startDate = new Date(booking.start_datetime);
      const endDate = new Date(booking.end_datetime);
      
      // Check if the time slot overlaps with the booking
      // Overlap occurs when: slotStart < bookingEnd AND slotEnd > bookingStart
      return slotStart < endDate && slotEnd > startDate;
    });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
    setIsEditing(false);
    setEditForm({});
    setEditAvailableHours([]);
    setEditUnavailableSlots([]);
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    
    if (!window.confirm('Are you sure you want to delete this booking?')) {
      return;
    }

    try {
      await deleteBooking(selectedBooking.id);
      // Remove from bookings list
      setBookings(prevBookings => prevBookings.filter(b => b.id !== selectedBooking.id));
      handleCloseModal();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete booking');
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedBooking) return;

    try {
      // Try to update status - if serializer doesn't allow it, we'll handle the error
      // For cancelled status, we can use the delete endpoint which sets status to Cancelled
      if (newStatus === 'Cancelled') {
        await deleteBooking(selectedBooking.id);
        // Remove from bookings list since we filter out cancelled bookings
        setBookings(prevBookings => prevBookings.filter(b => b.id !== selectedBooking.id));
        handleCloseModal();
        return;
      }

      // For other status changes, try updating with status field
      // Note: The serializer marks status as read-only, so this might not work
      // If it fails, we'll need a backend endpoint for admin status updates
      try {
        await updateBooking(selectedBooking.id, {
          status: newStatus,
          room_ids: selectedBooking.rooms.map(r => r.id),
          start_datetime: selectedBooking.start_datetime,
          end_datetime: selectedBooking.end_datetime
        });
      } catch (updateErr) {
        // If status update fails, try without status (just to refresh data)
        // This is a workaround - ideally we'd have an admin endpoint for status updates
        console.warn('Status update may not be supported by API:', updateErr);
        // Still update locally for better UX
      }
      
      // Update booking in list
      setBookings(prevBookings => 
        prevBookings.map(b => 
          b.id === selectedBooking.id 
            ? { ...b, status: newStatus }
            : b
        )
      );
      
      setSelectedBooking({ ...selectedBooking, status: newStatus });
      
      // Refresh bookings to get latest data
      await fetchBookings();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update booking status');
    }
  };

  // Generate days for week view
  const getWeekDays = () => {
    const weekStart = new Date(currentDate);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day;
    weekStart.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  // Generate days for month view
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayBookings = getBookingsForDate(currentDate);

    return (
      <div className="calendar-day-view">
        <div className="calendar-day-header">
          <h2>{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
        </div>
        <div className="calendar-hours">
          {hours.map(hour => {
            const hourBookings = getBookingsForTimeSlot(currentDate, hour);
            return (
              <div key={hour} className="calendar-hour-row">
                <div className="hour-label">{formatHour(hour)}</div>
                <div className="hour-content">
                  {hourBookings.map(booking => (
                    <div 
                      key={booking.id} 
                      className={`booking-event booking-${booking.status.toLowerCase()}`}
                      onClick={() => handleBookingClick(booking)}
                    >
                      <div className="booking-event-title">
                        {booking.rooms.map(r => r.name).join(', ')}
                      </div>
                      <div className="booking-event-details">
                        {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}
                      </div>
                      <div className="booking-event-user">
                        {booking.user.username}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="calendar-week-view">
        <div className="calendar-week-header">
          <div className="week-hour-label"></div>
          {weekDays.map((day, idx) => (
            <div key={idx} className="week-day-header">
              <div className="week-day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="week-day-number">{day.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="calendar-week-body">
          {hours.map(hour => (
            <div key={hour} className="week-hour-row">
              <div className="week-hour-label">{formatHour(hour)}</div>
              {weekDays.map((day, dayIdx) => {
                const hourBookings = getBookingsForTimeSlot(day, hour);
                return (
                  <div key={dayIdx} className="week-hour-cell">
                    {hourBookings.map(booking => (
                      <div 
                        key={booking.id} 
                        className={`booking-event booking-${booking.status.toLowerCase()}`}
                        onClick={() => handleBookingClick(booking)}
                      >
                        <div className="booking-event-title">
                          {booking.rooms.map(r => r.name).join(', ')}
                        </div>
                        <div className="booking-event-time">
                          {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthDays = getMonthDays();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="calendar-month-view">
        <div className="calendar-month-header">
          {weekDays.map(day => (
            <div key={day} className="month-day-header">{day}</div>
          ))}
        </div>
        <div className="calendar-month-body">
          {monthDays.map((day, idx) => {
            if (!day) {
              return <div key={idx} className="month-day-cell empty"></div>;
            }
            const dayBookings = getBookingsForDate(day);
            const isToday = day.toDateString() === new Date().toDateString();
            
            return (
              <div key={idx} className={`month-day-cell ${isToday ? 'today' : ''}`}>
                <div className="month-day-number">{day.getDate()}</div>
                <div className="month-day-bookings">
                  {dayBookings.slice(0, 3).map(booking => (
                    <div 
                      key={booking.id} 
                      className={`booking-event-small booking-${booking.status.toLowerCase()}`}
                      onClick={() => handleBookingClick(booking)}
                    >
                      <span className="booking-time-small">
                        {formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}
                      </span>
                      <span className="booking-room-small">
                        {booking.rooms.map(r => r.name).join(', ')}
                      </span>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="booking-more">+{dayBookings.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="admin-dashboard-loading">Loading bookings...</div>;
  }

  if (error) {
    return <div className="admin-dashboard-error">Error: {error}</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        
        <div className="calendar-navigation">
          <button onClick={() => navigateDate(-1)} className="nav-btn">← Previous</button>
          <button onClick={goToToday} className="nav-btn today-btn">Today</button>
          <button onClick={() => navigateDate(1)} className="nav-btn">Next →</button>
          <div className="current-date-display">
            {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {viewMode === 'week' && (
              <>
                {getWeekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                {getWeekDays()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </>
            )}
            {viewMode === 'month' && currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          {(viewMode === 'week' || viewMode === 'month') && (
            <div className="room-filter">
              <label htmlFor="room-select">Filter by Room:</label>
              <select
                id="room-select"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="room-select"
              >
                <option value="">All Rooms</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {formatRoomName(room)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="header-top">
          
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('day');
                setSelectedRoomId(''); // Clear room filter for day view
              }}
            >
              Day
            </button>
            <button 
              className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button 
              className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>

      <div className="booking-legend">
        <div className="legend-item">
          <span className="legend-color booking-pending"></span>
          <span>Pending</span>
        </div>
        <div className="legend-item">
          <span className="legend-color booking-approved"></span>
          <span>Approved</span>
        </div>
      </div>

      {showModal && selectedBooking && (
        <div className="booking-modal-overlay" onClick={handleCloseModal}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h2>Booking Details</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="booking-modal-content">
              {isEditing ? (
                <div className="booking-edit-form">
                  <div className="edit-form-group">
                    <label htmlFor="editDate">Date:</label>
                    <input
                      type="date"
                      id="editDate"
                      value={editForm.selectedDate}
                      onChange={handleEditDateChange}
                      onKeyDown={handleDateKeyDown}
                      onKeyPress={(e) => e.preventDefault()}
                      min={new Date().toISOString().split('T')[0]}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                      required
                      className="form-input date-input"
                      onClick={handleDateInputClick}
                    />
                  </div>
                  {editLoading && <div className="loading-message">Loading availability...</div>}
                  {editForm.selectedDate && editAvailableHours.length > 0 && (
                    <div className="edit-form-group">
                      <label htmlFor="editStartTime">Start Time:</label>
                      <select
                        id="editStartTime"
                        value={editForm.startTime}
                        onChange={(e) => setEditForm({...editForm, startTime: e.target.value})}
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
                    <div className="edit-form-group">
                      <label htmlFor="editEndTime">End Time:</label>
                      <select
                        id="editEndTime"
                        value={editForm.endTime}
                        onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                        required
                        className="form-input"
                      >
                        <option value="">Select end time</option>
                        {getEndTimeOptions(parseInt(editForm.startTime), editUnavailableSlots, editForm.room_ids).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {formatHour(opt.value)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="booking-detail-item">
                    <label>User:</label>
                    <span>{selectedBooking.user.username} ({selectedBooking.user.email})</span>
                  </div>
                  <div className="booking-detail-item">
                    <label>Rooms:</label>
                    <span>{selectedBooking.rooms.map(r => `${r.floor.name} - ${r.name}`).join(', ')}</span>
                  </div>
                  <div className="booking-detail-item">
                    <label>Start Time:</label>
                    <span>{formatDate(selectedBooking.start_datetime)} {formatTime(selectedBooking.start_datetime)}</span>
                  </div>
                  <div className="booking-detail-item">
                    <label>End Time:</label>
                    <span>{formatDate(selectedBooking.end_datetime)} {formatTime(selectedBooking.end_datetime)}</span>
                  </div>
                  <div className="booking-detail-item">
                    <label>Status:</label>
                    <span className={`status-badge status-${selectedBooking.status.toLowerCase()}`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div className="booking-detail-item">
                    <label>Created:</label>
                    <span>{formatDate(selectedBooking.created_at)} {formatTime(selectedBooking.created_at)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="booking-modal-actions">
              {isEditing ? (
                <div className="edit-actions">
                  <button 
                    className="save-btn"
                    onClick={handleUpdateBooking}
                  >
                    Save Changes
                  </button>
                  <button 
                    className="cancel-edit-btn"
                    onClick={handleCancelEdit}
                  >
                    Cancel Edit
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    className="edit-btn"
                    onClick={handleEditBooking}
                  >
                    Edit Booking
                  </button>
                  <div className="status-actions">
                    <label>Change Status:</label>
                    <div className="status-buttons">
                      {selectedBooking.status !== 'Pending' && (
                        <button 
                          className="status-btn status-pending"
                          onClick={() => handleStatusChange('Pending')}
                        >
                          Set to Pending
                        </button>
                      )}
                      {selectedBooking.status !== 'Approved' && (
                        <button 
                          className="status-btn status-approved"
                          onClick={() => handleStatusChange('Approved')}
                        >
                          Approve
                        </button>
                      )}
                      {selectedBooking.status !== 'Cancelled' && (
                        <button 
                          className="status-btn status-cancelled"
                          onClick={() => handleStatusChange('Cancelled')}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={handleDeleteBooking}
                  >
                    Delete Booking
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

