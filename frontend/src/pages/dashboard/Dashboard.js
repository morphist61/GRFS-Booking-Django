import React, { useEffect, useState } from 'react';
import { getUser } from '../../services/api';

const Dashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser()
      .then((res) => setUser(res.data))
      .catch((err) => console.error('Error fetching user info:', err));
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {user && <p>Welcome, {user.username}! Role: {user.role}</p>}
    </div>
  );
};

export default Dashboard;
