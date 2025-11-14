import React, { useState } from 'react';
import { loginUser } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import '../../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); // Rename username to email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Prepare the data to be sent to the backend with email and password
  const dataToSend = {
    email: email,  // Send email as the email field, not username
    password: password,
  };

  console.log("Sending data to backend:", dataToSend);  // Log the request data for debugging

  try {
    const res = await loginUser(dataToSend);  // Send the data to the backend
    console.log("Backend response:", res.data);  // Log the successful response
    localStorage.setItem('access', res.data.access);
    localStorage.setItem('refresh', res.data.refresh);
    navigate('/bookingpage');
  } catch (err) {
    console.error("Login error:", err.response?.data || err.message);  // Log error details
    setError('Invalid credentials. Please try again.');
  }
};

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"  // Input should accept email
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default LoginPage;
