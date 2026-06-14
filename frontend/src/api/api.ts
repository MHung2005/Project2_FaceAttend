import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/* ── Auth ── */
export const loginManager   = (username: string, password: string) =>
  api.post('/auth/login', { username, password });

export const loginEmployee  = (username: string, password: string) =>
  api.post('/auth/employee/login', { username, password });

/* ── Guest / Employee check-in ── */
export const checkinFace    = (fd: FormData) =>
  api.post('/checkin', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

/* ── Manager: employees ── */
export const registerEmployee = (fd: FormData) =>
  api.post('/manager/employees', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getEmployees   = () => api.get('/manager/employees');

export const deleteEmployee = (userId: string) =>
  api.delete(`/manager/employees/${userId}`);

export const updateEmployee = (
  userId: string,
  data: { name: string; department: string; position: string }
) => api.put(`/manager/employees/${userId}`, data);

/* ── Manager: pending approval (MỚI) ── */
export const getPendingEmployees = () =>
  api.get('/manager/employees/pending');

export const approveEmployee = (userId: string, status: 'approved' | 'rejected') =>
  api.put(`/manager/employees/${userId}/approve`, { status });

/* ── Manager: location config (MỚI) ── */
export const getLocationConfig = () =>
  api.get('/manager/location');

export const setLocationConfig = (lat: number, lng: number, radius: number) =>
  api.put('/manager/location', { lat, lng, radius });

/* ── Manager: attendance & stats ── */
export const getAttendance   = (date?: string) =>
  api.get('/manager/attendance', { params: { date } });

export const getStats        = () => api.get('/manager/stats');

export const getWeeklyStats  = () => api.get('/manager/stats/weekly');

export const getStatsByRange = (start_date: string, end_date: string) =>
  api.get('/manager/stats/range', { params: { start_date, end_date } });