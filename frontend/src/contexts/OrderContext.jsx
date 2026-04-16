import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOrders, getSettings, updateOrderStatus } from '../services/api';
import { useAuth } from './AuthContext';

const SETTINGS_CACHE_KEY = 'odms_settings_cache';
const DEFAULT_REFRESH_INTERVAL_MS = 5000;

const toRefreshIntervalMs = (secondsValue) => {
  const parsed = Number(secondsValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }
  return Math.max(1000, Math.round(parsed * 1000));
};

const OrderContext = createContext();

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_INTERVAL_MS);

  // Fetch orders on mount
  useEffect(() => {
    if (!user || user.role !== 'restaurant_admin') {
      setOrders([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const loadRefreshInterval = async () => {
      try {
        const cachedRaw = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && typeof cached === 'object') {
            setRefreshIntervalMs(toRefreshIntervalMs(cached.refresh_interval));
          }
        }
      } catch {
        // Ignore cache read errors.
      }

      try {
        const settings = await getSettings();
        if (settings && typeof settings === 'object') {
          setRefreshIntervalMs(toRefreshIntervalMs(settings.refresh_interval));

          try {
            const cachedRaw = localStorage.getItem(SETTINGS_CACHE_KEY);
            const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
            const nextCache = {
              ...(cached && typeof cached === 'object' ? cached : {}),
              refresh_interval: settings.refresh_interval,
            };
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextCache));
          } catch {
            // Ignore cache write errors.
          }
        }
      } catch {
        // Keep existing polling interval when settings call fails.
      }
    };

    fetchOrders();

    // Set up polling for real-time updates using the configured interval.
    const interval = setInterval(fetchOrders, refreshIntervalMs);
    loadRefreshInterval();
    
    return () => clearInterval(interval);
  }, [user, refreshIntervalMs]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getOrders();
      setOrders(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async (orderId, status) => {
    try {
      const updatedOrder = await updateOrderStatus(orderId, status);
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, ...updatedOrder } : order
        )
      );
      // Force a fresh pull right after mutation so assignment/status changes appear instantly.
      await fetchOrders();
      return updatedOrder;
    } catch (err) {
      console.error('Error updating order:', err);
      throw err;
    }
  };

  const getOrdersByStatus = (status) => {
    return orders.filter(order => order.status === status);
  };

  const getPendingOrders = () => {
    return orders.filter(order => 
      ['pending', 'preparing', 'ready', 'assigned', 'out_for_delivery'].includes(order.status)
    );
  };

  const value = {
    orders,
    loading,
    error,
    updateOrder,
    refreshOrders: fetchOrders,
    getOrdersByStatus,
    getPendingOrders,
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};
