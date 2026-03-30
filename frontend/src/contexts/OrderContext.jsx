import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOrders, updateOrderStatus } from '../services/api';
import { useAuth } from './AuthContext';

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

  // Fetch orders on mount
  useEffect(() => {
    if (!user || user.role !== 'restaurant_admin') {
      setOrders([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    fetchOrders();
    
    // Set up polling for real-time updates (every 5 seconds)
    const interval = setInterval(fetchOrders, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

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
