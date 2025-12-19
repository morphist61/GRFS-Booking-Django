import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../services/api';
import '../styles/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  const fetchUser = async () => {
    const token = localStorage.getItem('access');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await getUser();
      setUser(response.data);
    } catch (err) {
      // User not logged in or token expired
      setUser(null);
      // Clear tokens if they're invalid
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
    }
  };

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('access');
    if (!token) {
      setUser(null);
      return;
    }
    
    // Fetch user data when route changes or component mounts
    fetchUser();
  }, [location.pathname]); // Re-fetch when route changes (e.g., after login)

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setUser(null); // Clear user state immediately
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          
          <span className="navbar-brand-text">GRFS Booking</span>
        </Link>
        <div className="navbar-menu">
          {user ? (
            <>
              <Link to="/dashboard" className="navbar-link">My Bookings</Link>
              <Link to="/bookingpage" className="navbar-link">Book Rooms</Link>
              {user && user.role === 'admin' && (
                <Link to="/admin" className="navbar-link">Admin</Link>
              )}
              <div className="navbar-user">
                <span className="navbar-username">{user.first_name} {user.last_name}</span>
                <button onClick={handleLogout} className="navbar-logout">Logout</button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Login</Link>
              <Link to="/register" className="navbar-link">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

