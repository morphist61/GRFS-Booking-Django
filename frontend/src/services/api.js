import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/';

const API = axios.create({
  baseURL: API_BASE_URL,
});

// Automatically attach JWT token to every request if it exists
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token && !config.url.includes('auth/register')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401 errors
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}auth/refresh/`, {
            refresh: refreshToken
          });
          const { access } = response.data;
          localStorage.setItem('access', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return API(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default API;
export const registerUser = async (data) => {
  return await API.post('auth/register/', data);
};

export const loginUser = async (data) => {
  return await API.post('auth/login/', data);
};

export const getUser = async () => {
  return await API.get('auth/user/');
};

export const checkAvailability = async (date, roomIds) => {
  const roomIdsStr = Array.isArray(roomIds) ? roomIds.join(',') : roomIds;
  return await API.get(`check_availability/?date=${date}&room_ids=${roomIdsStr}`);
};

export const createBooking = async (data) => {
  return await API.post('create_booking/', data);
};

export const getFloors = async () => {
  return await API.get('floors/');
};

export const getRooms = async (floorId = null) => {
  const url = floorId ? `rooms/?floor=${floorId}` : 'rooms/';
  return await API.get(url);
};

export const getMyBookings = async () => {
  return await API.get('bookings/my');
};

export const getBooking = async (bookingId) => {
  return await API.get(`bookings/${bookingId}/`);
};

export const updateBooking = async (bookingId, data) => {
  return await API.put(`bookings/${bookingId}/`, data);
};

export const deleteBooking = async (bookingId) => {
  return await API.delete(`bookings/${bookingId}/`);
};

export const getAllBookings = async () => {
  return await API.get('bookings/');
};

export const getPendingUsers = async () => {
  return await API.get('admin/pending-users/');
};

export const approveUser = async (userId, action, role = null) => {
  return await API.post(`admin/approve-user/${userId}/`, { action, role });
};

export const updateBookingStatus = async (bookingId, status) => {
  return await API.post(`admin/bookings/${bookingId}/status/`, { status });
};