import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFloors, getRooms, getUser } from '../../services/api';
import '../../styles/BookingPage.css';

const BookingPage = () => {
  const navigate = useNavigate();
  const [floors, setFloors] = useState([]);
  const [fetchedRooms, setFetchedRooms] = useState({}); // Cache rooms for each floor
  const [activeFloors, setActiveFloors] = useState({}); // Track active floors
  const [selectedRooms, setSelectedRooms] = useState([]); // Track selected rooms
  const [selectedFloors, setSelectedFloors] = useState([]); // Track selected floors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fetch user data to check role
    const fetchUserData = async () => {
      try {
        const response = await getUser();
        setUser(response.data);
      } catch (err) {
        // User not logged in or token expired - handled by PrivateRoute
        setUser(null);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    // Fetch floors data from your API
    const fetchFloorsData = async () => {
      try {
        setLoading(true);
        const response = await getFloors();
        setFloors(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch floors');
      } finally {
        setLoading(false);
      }
    };
    fetchFloorsData();
  }, []);

  const fetchRooms = async (floorId) => {
    // If rooms are already fetched for this floor, no need to fetch again
    if (fetchedRooms[floorId]) return fetchedRooms[floorId];

    try {
      const response = await getRooms(floorId);
      const rooms = response.data;
      setFetchedRooms((prevRooms) => ({
        ...prevRooms,
        [floorId]: rooms, // Cache rooms for the selected floor
      }));
      return rooms;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch rooms');
      return null;
    }
  };

  const toggleFloor = (floorId, e) => {
    // Prevent the header from collapsing when the "Book Entire Floor" button is clicked
    if (e.target.classList.contains('book-floor-btn')) return;

    // Toggle the active floor state, allow multiple floors to stay open
    setActiveFloors((prev) => ({
      ...prev,
      [floorId]: !prev[floorId], // Toggle the current floor's active state
    }));

    // Fetch rooms only when the floor is opened
    if (!fetchedRooms[floorId]) {
      fetchRooms(floorId);
    }
  };

  const handleRoomSelection = (roomId) => {
    // Handle room selection (clicking anywhere on the room item)
    if (selectedRooms.includes(roomId)) {
      setSelectedRooms((prev) => prev.filter((id) => id !== roomId));
    } else {
      setSelectedRooms((prev) => [...prev, roomId]);
    }
  };

  const handleFloorBooking = async (floorId) => {
    // Ensure rooms are fetched before trying to select them
    let rooms = fetchedRooms[floorId];
    
    if (!rooms || !Array.isArray(rooms)) {
      // Fetch rooms for this floor first if not already fetched
      rooms = await fetchRooms(floorId);
    }
    
    // Only proceed if we have valid rooms
    if (rooms && Array.isArray(rooms) && rooms.length > 0) {
      const roomsForFloor = rooms.map((room) => room.id);
      setSelectedRooms((prev) => [...prev, ...roomsForFloor]);
      setSelectedFloors((prev) => [...prev, floorId]);
    } else {
      setError('Unable to fetch rooms for this floor. Please try again.');
    }
  };

  const handleSubmit = () => {
    // Navigate to the booking form with the selected rooms or floors
    if (selectedRooms.length > 0 || selectedFloors.length > 0) {
      navigate(`/booking-form?rooms=${selectedRooms.join(',')}&floors=${selectedFloors.join(',')}`);
    } else {
      alert('Please select at least one room or book a floor!');
    }
  };

  const handleCampBooking = async (floorId) => {
    // Check if user has permission to book camps
    if (!user || !['mentor', 'coordinator', 'admin'].includes(user.role)) {
      alert('Only mentors, coordinators, and admins can book camps.');
      return;
    }

    // Ensure rooms are fetched before trying to select them
    let rooms = fetchedRooms[floorId];
    
    if (!rooms || !Array.isArray(rooms)) {
      // Fetch rooms for this floor first if not already fetched
      rooms = await fetchRooms(floorId);
    }
    
    // Only proceed if we have valid rooms
    if (rooms && Array.isArray(rooms) && rooms.length > 0) {
      const roomsForFloor = rooms.map((room) => room.id);
      // Navigate directly to booking form with camp type and all downstairs rooms
      navigate(`/booking-form?rooms=${roomsForFloor.join(',')}&type=camp`);
    } else {
      setError('Unable to fetch rooms for this floor. Please try again.');
    }
  };

  // Helper function to check if a floor is downstairs
  const isDownstairsFloor = (floor) => {
    const name = floor.name.toLowerCase();
    return name.includes('downstairs') || name.includes('first') || name.includes('ground') || name === '1' || name === 'floor 1';
  };

  return (
    <div className="container">
      <h2>Building Rooms</h2>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && <div className="loading-message">Loading floors...</div>}

      <div className="accordion">
        {floors.map((floor) => (
          <div key={floor.id} className="floor">
            <div
              className="floor-header"
              
              onClick={(e) => toggleFloor(floor.id, e)} // Pass the event to prevent collapsing
            >
              <div className="floor-header-text">
                <h3>{floor.name}</h3>
                <h4>click to display rooms</h4>
              </div>
              <div className="floor-header-buttons">
                {isDownstairsFloor(floor) && user && ['mentor', 'coordinator', 'admin'].includes(user.role) && (
                  <button 
                    className="book-camp-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCampBooking(floor.id);
                    }}
                  >
                    Book for Camp
                  </button>
                )}
                <button 
                  className="book-floor-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFloorBooking(floor.id);
                  }}
                >
                  Select Entire Floor
                </button>
              </div>
            </div>

            {activeFloors[floor.id] && (
              <div className="floor-content">
                <ul>
                  {fetchedRooms[floor.id] && fetchedRooms[floor.id].length > 0 ? (
                    fetchedRooms[floor.id].map((room) => (
                      <li key={room.id} className="room-item" onClick={() => handleRoomSelection(room.id)}>
                        <div className="room-content">
                          <img src={room.image} alt={room.name} className="room-image" />
                          <span className="room-name">{room.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          id={`room-${room.id}`}
                          onChange={(e) => handleRoomSelection(room.id)} // This ensures it can also be toggled via the checkbox
                          checked={selectedRooms.includes(room.id)}
                        />
                      </li>
                    ))
                  ) : (
                    <li>No rooms available</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <button 
        onClick={handleSubmit} 
        className="booking-form-btn"
        disabled={selectedRooms.length === 0 && selectedFloors.length === 0}
      >
        Go to Booking Form
      </button>
    </div>
  );
};

export default BookingPage;
