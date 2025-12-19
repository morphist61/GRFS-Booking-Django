import React, { useState } from 'react';
import { registerUser } from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    gender: '',
  });
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate password length
    if (formData.password.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    // Validate email format (more comprehensive)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(formData.email.trim())) {
      setMessage('Please enter a valid email address.');
      return;
    }
    
    // Additional email validation
    if (formData.email.trim().length === 0) {
      setMessage('Email is required.');
      return;
    }
    
    if (formData.email.length > 100) {
      setMessage('Email address is too long (maximum 100 characters).');
      return;
    }

    // Set username to the email value
    const dataWithUsername = { ...formData, username: formData.email };

    try {
      await registerUser(dataWithUsername);
      setMessage('Registration successful! Your account is pending approval. You will be able to log in once an administrator approves your account.');
      setTimeout(() => navigate('/login'), 4000);
    } catch (err) {
      // Show user-friendly error message
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.email?.[0] ||
                          err.response?.data?.password?.[0] ||
                          'Error during registration. Please try again.';
      setMessage(errorMessage);
    }
  };

  return (
    <div className="register-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input 
          name="first_name" 
          placeholder="First Name" 
          onChange={handleChange} 
          required 
          maxLength={50}
        />
        <input 
          name="last_name" 
          placeholder="Last Name" 
          onChange={handleChange} 
          required 
          maxLength={50}
        />
        <input 
          type="email"
          name="email" 
          placeholder="Email" 
          value={formData.email}
          onChange={handleChange} 
          required 
          maxLength={100}
        />
        <select
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          required
          className="form-select"
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <div className="password-input-wrapper">
          <input 
            type={showPassword ? "text" : "password"} 
            name="password" 
            placeholder="Password (min 8 characters)" 
            value={formData.password}
            onChange={handleChange} 
            required 
            minLength={8}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPassword(!showPassword);
            }}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>
        <button type="submit">Register</button>
      </form>
      {message && <p className="success-message">{message}</p>}
      <p className="auth-link">
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default RegisterPage;

