/**
 * Tests for the API service layer (services/api.js).
 * Mocks axios to verify correct endpoint calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  };
  return { default: mockAxios };
});

// Must import AFTER mocking axios
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  createOrder,
  getHeatmapData,
  optimizeRoute,
  getActiveRoutes,
  getRestaurant,
  registerRestaurant,
  updateRestaurant,
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getAnalyticsSummary,
  getSettings,
  updateSettings,
  getAllRoutes,
  getRouteById,
} from '../services/api';

const api = axios;

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Orders ---
  describe('Orders API', () => {
    it('getOrders calls GET /orders', async () => {
      api.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
      const result = await getOrders();
      expect(api.get).toHaveBeenCalledWith('/orders');
      expect(result).toEqual([{ id: 1 }]);
    });

    it('getOrderById calls GET /orders/:id', async () => {
      api.get.mockResolvedValueOnce({ data: { id: 5 } });
      const result = await getOrderById(5);
      expect(api.get).toHaveBeenCalledWith('/orders/5');
      expect(result).toEqual({ id: 5 });
    });

    it('updateOrderStatus calls PATCH /orders/:id', async () => {
      api.patch.mockResolvedValueOnce({ data: { id: 1, status: 'ready' } });
      const result = await updateOrderStatus(1, 'ready');
      expect(api.patch).toHaveBeenCalledWith('/orders/1', { status: 'ready' });
      expect(result.status).toBe('ready');
    });

    it('createOrder calls POST /orders', async () => {
      const orderData = { customer_name: 'Test' };
      api.post.mockResolvedValueOnce({ data: { id: 1, ...orderData } });
      const result = await createOrder(orderData);
      expect(api.post).toHaveBeenCalledWith('/orders', orderData);
      expect(result.customer_name).toBe('Test');
    });

    it('getOrders throws on API error', async () => {
      api.get.mockRejectedValueOnce(new Error('Network Error'));
      await expect(getOrders()).rejects.toThrow('Network Error');
    });
  });

  // --- Heatmap ---
  describe('Heatmap API', () => {
    it('getHeatmapData calls GET /heatmap/:type', async () => {
      api.get.mockResolvedValueOnce({ data: { points: [] } });
      await getHeatmapData('live');
      expect(api.get).toHaveBeenCalledWith('/heatmap/live');
    });

    it('getHeatmapData defaults to live', async () => {
      api.get.mockResolvedValueOnce({ data: {} });
      await getHeatmapData();
      expect(api.get).toHaveBeenCalledWith('/heatmap/live');
    });
  });

  // --- Routes ---
  describe('Routes API', () => {
    it('optimizeRoute calls POST /routes/optimize', async () => {
      api.post.mockResolvedValueOnce({ data: { routes: [] } });
      await optimizeRoute([1, 2]);
      expect(api.post).toHaveBeenCalledWith('/routes/optimize', { orderIds: [1, 2] });
    });

    it('getActiveRoutes calls GET /routes/active', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getActiveRoutes();
      expect(api.get).toHaveBeenCalledWith('/routes/active');
    });

    it('getAllRoutes calls GET /routes', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getAllRoutes();
      expect(api.get).toHaveBeenCalledWith('/routes');
    });

    it('getAllRoutes with status filter', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getAllRoutes('active');
      expect(api.get).toHaveBeenCalledWith('/routes?status=active');
    });

    it('getRouteById calls GET /routes/:id', async () => {
      api.get.mockResolvedValueOnce({ data: { id: 'R1' } });
      await getRouteById('R1');
      expect(api.get).toHaveBeenCalledWith('/routes/R1');
    });
  });

  // --- Restaurant ---
  describe('Restaurant API', () => {
    it('getRestaurant calls GET /restaurant', async () => {
      api.get.mockResolvedValueOnce({ data: { name: 'Test' } });
      const result = await getRestaurant();
      expect(api.get).toHaveBeenCalledWith('/restaurant');
      expect(result.name).toBe('Test');
    });

    it('registerRestaurant calls POST /restaurant', async () => {
      const data = { name: 'New', latitude: 1, longitude: 2 };
      api.post.mockResolvedValueOnce({ data: { id: 1, ...data } });
      await registerRestaurant(data);
      expect(api.post).toHaveBeenCalledWith('/restaurant', data);
    });

    it('updateRestaurant calls PUT /restaurant', async () => {
      const data = { name: 'Updated' };
      api.put.mockResolvedValueOnce({ data });
      await updateRestaurant(data);
      expect(api.put).toHaveBeenCalledWith('/restaurant', data);
    });
  });

  // --- Drivers ---
  describe('Drivers API', () => {
    it('getDrivers calls GET /drivers', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getDrivers();
      expect(api.get).toHaveBeenCalledWith('/drivers');
    });

    it('getDrivers with status filter', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getDrivers('available');
      expect(api.get).toHaveBeenCalledWith('/drivers?status=available');
    });

    it('getDriverById calls GET /drivers/:id', async () => {
      api.get.mockResolvedValueOnce({ data: { id: 'DRV001' } });
      await getDriverById('DRV001');
      expect(api.get).toHaveBeenCalledWith('/drivers/DRV001');
    });

    it('createDriver calls POST /drivers', async () => {
      const data = { name: 'Driver', phone: '+1' };
      api.post.mockResolvedValueOnce({ data: { id: 'DRV001', ...data } });
      await createDriver(data);
      expect(api.post).toHaveBeenCalledWith('/drivers', data);
    });

    it('updateDriver calls PUT /drivers/:id', async () => {
      api.put.mockResolvedValueOnce({ data: {} });
      await updateDriver('DRV001', { name: 'Updated' });
      expect(api.put).toHaveBeenCalledWith('/drivers/DRV001', { name: 'Updated' });
    });

    it('deleteDriver calls DELETE /drivers/:id', async () => {
      api.delete.mockResolvedValueOnce({ data: {} });
      await deleteDriver('DRV001');
      expect(api.delete).toHaveBeenCalledWith('/drivers/DRV001');
    });
  });

  // --- Analytics ---
  describe('Analytics API', () => {
    it('getAnalyticsSummary calls GET /analytics/summary with default range', async () => {
      api.get.mockResolvedValueOnce({ data: { revenue: {} } });
      await getAnalyticsSummary();
      expect(api.get).toHaveBeenCalledWith('/analytics/summary?timeRange=7days');
    });

    it('getAnalyticsSummary with custom range', async () => {
      api.get.mockResolvedValueOnce({ data: {} });
      await getAnalyticsSummary('today');
      expect(api.get).toHaveBeenCalledWith('/analytics/summary?timeRange=today');
    });
  });

  // --- Settings ---
  describe('Settings API', () => {
    it('getSettings calls GET /settings', async () => {
      api.get.mockResolvedValueOnce({ data: {} });
      await getSettings();
      expect(api.get).toHaveBeenCalledWith('/settings');
    });

    it('updateSettings calls PUT /settings', async () => {
      const settings = { business_name: 'New' };
      api.put.mockResolvedValueOnce({ data: { updated: ['business_name'] } });
      await updateSettings(settings);
      expect(api.put).toHaveBeenCalledWith('/settings', settings);
    });
  });
});
