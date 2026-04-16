// Affiliation API
export const getAllRestaurants = async () => {
  try {
    const response = await api.get('/restaurants');
    return response.data;
  } catch (error) {
    console.error('API Error - Get All Restaurants:', error);
    throw error;
  }
};

export const applyForAffiliation = async (restaurantId) => {
  try {
    const response = await api.post('/affiliation/apply', { restaurant_id: restaurantId });
    return response.data;
  } catch (error) {
    console.error('API Error - Apply For Affiliation:', error);
    throw error;
  }
};

export const getAffiliationRequests = async () => {
  try {
    const response = await api.get('/affiliation/restaurant/requests');
    return response.data;
  } catch (error) {
    console.error('API Error - Get Affiliation Requests:', error);
    throw error;
  }
};

export const approveAffiliationRequest = async (requestId) => {
  try {
    const response = await api.post(`/affiliation/restaurant/requests/${requestId}/approve`);
    return response.data;
  } catch (error) {
    console.error('API Error - Approve Affiliation Request:', error);
    throw error;
  }
};

export const rejectAffiliationRequest = async (requestId) => {
  try {
    const response = await api.post(`/affiliation/restaurant/requests/${requestId}/reject`);
    return response.data;
  } catch (error) {
    console.error('API Error - Reject Affiliation Request:', error);
    throw error;
  }
};
import axios from 'axios';

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('odms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('odms_token');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Orders API
export const getOrders = async () => {
  try {
    const response = await api.get('/orders');
    return response.data;
  } catch (error) {
    console.error('API Error - Get Orders:', error);
    throw error;
  }
};

export const getOrderById = async (orderId) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Order:', error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    const response = await api.patch(`/orders/${orderId}`, { status });
    return response.data;
  } catch (error) {
    console.error('API Error - Update Order:', error);
    throw error;
  }
};

export const createOrder = async (orderData) => {
  try {
    const response = await api.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('API Error - Create Order:', error);
    throw error;
  }
};

// Heatmap API
export const getHeatmapData = async (type = 'live') => {
  try {
    const response = await api.get(`/heatmap/${type}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Heatmap:', error);
    throw error;
  }
};

// Route Optimization API
export const optimizeRoute = async (orderIds) => {
  try {
    const response = await api.post('/routes/optimize', { orderIds });
    return response.data;
  } catch (error) {
    console.error('API Error - Optimize Route:', error);
    throw error;
  }
};

export const getActiveRoutes = async () => {
  try {
    const response = await api.get('/routes/active');
    return response.data;
  } catch (error) {
    console.error('API Error - Get Active Routes:', error);
    throw error;
  }
};

// Restaurant API
export const getRestaurant = async () => {
  try {
    const response = await api.get('/restaurant');
    return response.data;
  } catch (error) {
    console.error('API Error - Get Restaurant:', error);
    throw error;
  }
};

export const registerRestaurant = async (data) => {
  try {
    const response = await api.post('/auth/register/restaurant', data);
    return response.data;
  } catch (error) {
    console.error('API Error - Register Restaurant:', error);
    throw error;
  }
};

export const updateRestaurant = async (data) => {
  try {
    const response = await api.put('/restaurant', data);
    return response.data;
  } catch (error) {
    console.error('API Error - Update Restaurant:', error);
    throw error;
  }
};

// Drivers API
export const getDrivers = async (status) => {
  try {
    const url = status ? `/drivers?status=${status}` : '/drivers';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Drivers:', error);
    throw error;
  }
};

export const getDriverById = async (driverId) => {
  try {
    const response = await api.get(`/drivers/${driverId}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Driver:', error);
    throw error;
  }
};

export const createDriver = async (driverData) => {
  try {
    const response = await api.post('/drivers', driverData);
    return response.data;
  } catch (error) {
    console.error('API Error - Create Driver:', error);
    throw error;
  }
};

export const updateDriver = async (driverId, driverData) => {
  try {
    const response = await api.put(`/drivers/${driverId}`, driverData);
    return response.data;
  } catch (error) {
    console.error('API Error - Update Driver:', error);
    throw error;
  }
};

export const deleteDriver = async (driverId) => {
  try {
    const response = await api.delete(`/drivers/${driverId}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Delete Driver:', error);
    throw error;
  }
};

// Analytics API
export const getAnalyticsSummary = async (timeRange = '7days') => {
  try {
    const response = await api.get(`/analytics/summary?timeRange=${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Analytics Summary:', error);
    throw error;
  }
};

// Settings API
export const getSettings = async () => {
  try {
    const response = await api.get('/settings');
    return response.data;
  } catch (error) {
    console.error('API Error - Get Settings:', error);
    throw error;
  }
};

export const updateSettings = async (settings) => {
  try {
    const response = await api.put('/settings', settings);
    return response.data;
  } catch (error) {
    console.error('API Error - Update Settings:', error);
    throw error;
  }
};

export const geocodeAddress = async (address) => {
  try {
    const cacheBuster = Date.now();
    const response = await api.get(`/geocode?address=${encodeURIComponent(address)}&_=${cacheBuster}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Geocode:', error);
    throw error;
  }
};

export const registerDriverAccount = async (payload) => {
  try {
    const response = await api.post('/auth/register/driver', payload);
    return response.data;
  } catch (error) {
    console.error('API Error - Register Driver Account:', error);
    throw error;
  }
};

export const registerPublicDriver = async (payload) => {
  try {
    const response = await api.post('/auth/register/driver/public', payload);
    return response.data;
  } catch (error) {
    console.error('API Error - Register Public Driver:', error);
    throw error;
  }
};

export const resetFirstLoginPassword = async (payload) => {
  try {
    const response = await api.post('/auth/reset-password-first-login', payload);
    return response.data;
  } catch (error) {
    console.error('API Error - Reset First Login Password:', error);
    throw error;
  }
};

// Routes API (additional)
export const getAllRoutes = async (status) => {
  try {
    const url = status ? `/routes?status=${status}` : '/routes';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('API Error - Get All Routes:', error);
    throw error;
  }
};

export const getRouteById = async (routeId) => {
  try {
    const response = await api.get(`/routes/${routeId}`);
    return response.data;
  } catch (error) {
    console.error('API Error - Get Route:', error);
    throw error;
  }
};

// Driver: Update own location
export const updateDriverLocation = async (latitude, longitude) => {
  try {
    const response = await api.patch('/driver/me/location', { latitude, longitude });
    return response.data;
  } catch (error) {
    console.error('API Error - Update Driver Location:', error);
    throw error;
  }
};

// Driver: Collect Cash for COD order
export const collectCash = async (orderId) => {
  try {
    const response = await api.patch(`/driver/me/orders/${orderId}/collect_cash`);
    return response.data;
  } catch (error) {
    console.error('API Error - Collect Cash:', error);
    throw error;
  }
};

export default api;
