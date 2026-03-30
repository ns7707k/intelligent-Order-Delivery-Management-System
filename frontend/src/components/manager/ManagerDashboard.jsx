import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Chip,
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Alert,
} from '@mui/material';
import { Activity, History, TrendingUp } from 'lucide-react';
import { useOrders } from '../../contexts/OrderContext';
import { getHeatmapData, getRestaurant } from '../../services/api';
import HeatmapView from './HeatmapView';
import OrderStats from './OrderStats';

/**
 * Manager Dashboard - Business Intelligence Interface
 * Interactive heatmap for live and predictive order visualization
 */
const ManagerDashboard = () => {
  const location = useLocation();
  const { orders } = useOrders();
  const [viewMode, setViewMode] = useState('live'); // 'live' or 'predictive'
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const liveOrderPoints = useMemo(() => (
    orders
      .filter((order) => order.latitude && order.longitude && order.status !== 'cancelled')
      .map((order) => ({
        lat: order.latitude,
        lng: order.longitude,
        intensity: order.status === 'delivered' ? 0.55 : order.status === 'out_for_delivery' ? 0.85 : 1,
        order_id: order.id,
        status: order.status,
        address: order.delivery_address,
      }))
  ), [orders]);

  const trackableOrders = useMemo(() => (
    orders.filter((order) => ['assigned', 'out_for_delivery', 'delivered'].includes(order.status))
  ), [orders]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetOrder = Number.parseInt(params.get('order') || '', 10);
    if (Number.isInteger(targetOrder)) {
      setSelectedOrderId(targetOrder);
      setViewMode('live');
    }
  }, [location.search]);

  useEffect(() => {
    if (!selectedOrderId && trackableOrders.length > 0) {
      setSelectedOrderId(trackableOrders[0].id);
      return;
    }

    if (selectedOrderId && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(trackableOrders[0]?.id || null);
    }
  }, [orders, selectedOrderId, trackableOrders]);

  // Load restaurant location on mount
  useEffect(() => {
    getRestaurant().then(data => {
      if (data?.latitude !== null && data?.latitude !== undefined && data?.longitude !== null && data?.longitude !== undefined) {
        setRestaurantLocation([data.latitude, data.longitude]);
      }
    }).catch(() => {});
  }, []);

  // Fetch heatmap data when view mode changes
  useEffect(() => {
    fetchHeatmapData();
  }, [viewMode, orders]);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (viewMode === 'live') {
        setHeatmapData(liveOrderPoints);
      } else {
        const data = await getHeatmapData(viewMode);
        setHeatmapData(data);
      }
    } catch (err) {
      console.error('Error fetching heatmap data:', err);
      setError('Failed to load heatmap data');
      // Fallback to mock data for development
      setHeatmapData(generateMockHeatmapData());
    } finally {
      setLoading(false);
    }
  };

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Generate mock heatmap data for development
  const generateMockHeatmapData = () => {
    if (viewMode === 'live') {
      // Convert current orders to heatmap points
      return orders
        .filter(order => order.latitude && order.longitude)
        .map(order => ({
          lat: order.latitude,
          lng: order.longitude,
          intensity: 1,
        }));
    } else {
      // Generate predictive hotspots (mock data)
      const hotspots = [];
      const centerLat = restaurantLocation?.[0] ?? 51.5074;
      const centerLng = restaurantLocation?.[1] ?? -0.1278;
      
      for (let i = 0; i < 50; i++) {
        hotspots.push({
          lat: centerLat + (Math.random() - 0.5) * 0.1,
          lng: centerLng + (Math.random() - 0.5) * 0.1,
          intensity: Math.random(),
        });
      }
      return hotspots;
    }
  };

  return (
    <Box sx={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#EEF2F8',
    }}>
      {/* Header */}
      <Paper 
        elevation={2}
        sx={{ 
          p: 2.5,
          borderRadius: 0,
          zIndex: 10,
          background: 'linear-gradient(135deg, #0A0F1E 0%, #162647 100%)',
          color: '#FFFFFF',
        }}
      >
        <Container maxWidth="xl">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Manager Dashboard
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)' }}>
                Real-time order tracking and predictive analytics
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Chip label={`Total orders: ${orders.length}`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.3)', color: '#FFFFFF' }} />
                <Chip label={`Live points: ${heatmapData.length}`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.3)', color: '#FFFFFF' }} />
                <Chip label={`Tracked deliveries: ${trackableOrders.length}`} size="small" sx={{ bgcolor: 'rgba(249,115,22,0.3)', color: '#FFFFFF' }} />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box
                  sx={{
                    p: 0.65,
                    borderRadius: 999,
                    display: 'inline-flex',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    gap: 0.5,
                  }}
                >
                  <Button
                    onClick={(event) => handleViewModeChange(event, 'live')}
                    variant="text"
                    startIcon={<Activity size={16} />}
                    sx={{
                      borderRadius: 999,
                      px: 2,
                      py: 0.75,
                      minWidth: 0,
                      color: viewMode === 'live' ? '#FFFFFF' : '#374151',
                      bgcolor: viewMode === 'live' ? '#3B82F6' : 'rgba(255,255,255,0.92)',
                      '&:hover': {
                        bgcolor: viewMode === 'live' ? '#2563EB' : 'rgba(55,65,81,0.08)',
                      },
                    }}
                  >
                    Live View
                  </Button>
                  <Button
                    onClick={(event) => handleViewModeChange(event, 'predictive')}
                    variant="text"
                    startIcon={<TrendingUp size={16} />}
                    sx={{
                      borderRadius: 999,
                      px: 2,
                      py: 0.75,
                      minWidth: 0,
                      color: viewMode === 'predictive' ? '#FFFFFF' : '#374151',
                      bgcolor: viewMode === 'predictive' ? '#3B82F6' : 'rgba(255,255,255,0.92)',
                      '&:hover': {
                        bgcolor: viewMode === 'predictive' ? '#2563EB' : 'rgba(55,65,81,0.08)',
                      },
                    }}
                  >
                    Predictive View
                  </Button>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Alert severity="warning" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Container>
      )}

      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <Box 
          sx={{ 
            py: 2,
            px: { xs: 2, md: 3 },
            display: 'flex',
            gap: 2,
            height: '100%',
            width: '100%',
            minHeight: 0,
          }}
        >
          {/* Map Section */}
          <Box sx={{ 
            flexGrow: 1,
            minWidth: 0,
            height: '100%',
          }}>
            <Paper 
              elevation={3}
              sx={{ 
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                border: '1px solid #D9E3F2',
                boxShadow: '0 16px 32px rgba(15,23,42,0.08)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 96,
                  zIndex: 2,
                  pointerEvents: 'none',
                  background: 'linear-gradient(180deg, rgba(10,15,30,0.34) 0%, rgba(10,15,30,0) 100%)',
                },
              }}
            >
              {/* View Mode Badge */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  zIndex: 1000,
                  bgcolor: 'rgba(10,15,30,0.8)',
                  px: 2,
                  py: 1,
                  borderRadius: 999,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  color: '#FFFFFF',
                }}
              >
                {viewMode === 'live' ? (
                  <>
                    <Activity size={16} />
                    <Typography variant="body2" fontWeight="medium">
                      Live Orders
                    </Typography>
                  </>
                ) : (
                  <>
                    <History size={16} />
                    <Typography variant="body2" fontWeight="medium">
                      Historical Hotspots
                    </Typography>
                  </>
                )}
              </Box>

              <HeatmapView 
                data={heatmapData}
                viewMode={viewMode}
                loading={loading}
                restaurantLocation={restaurantLocation}
                selectedOrderId={selectedOrderId}
                onSelectOrder={setSelectedOrderId}
              />
            </Paper>
          </Box>

          {/* Stats Sidebar */}
          <Box 
            className="manager-sidebar"
            sx={{ 
              width: { xs: '100%', lg: 360 },
              minWidth: { lg: 360 },
              display: { xs: 'none', lg: 'flex' },
              flexDirection: 'column',
              flexShrink: 0,
              height: '100%',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              pr: 1,
              pb: 5,
              scrollbarGutter: 'stable both-edges',
              '&::-webkit-scrollbar': {
                width: 8,
              },
              '&::-webkit-scrollbar-track': {
                background: '#E2E8F0',
                borderRadius: 999,
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#94A3B8',
                borderRadius: 999,
              },
            }}
          >
            <OrderStats
              orders={orders}
              viewMode={viewMode}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ManagerDashboard;
