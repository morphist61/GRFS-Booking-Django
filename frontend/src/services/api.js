import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api/',
});

// Automatically attach JWT token to every request if it exists
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token && !config.url.includes('auth/register')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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