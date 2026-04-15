import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  AttachMoney as AttachMoneyIcon,
  Restaurant as RestaurantIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  LocalShipping as LocalShippingIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { TrendingUp } from 'lucide-react';
import { getAnalyticsSummary } from '../../services/api';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [analytics, setAnalytics] = useState({
    revenue: { total: 0, growth: 0, orders: 0, avgOrderValue: 0 },
    orders: { total: 0, delivered: 0, cancelled: 0, avgDeliveryTime: 0 },
    drivers: { active: 0, totalDeliveries: 0, avgRating: 0, onTimeRate: 0 },
    topItems: [],
    hourlyDistribution: [],
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAnalyticsSummary(timeRange);
      setAnalytics({
        revenue: data.revenue || { total: 0, growth: 0, orders: 0, avgOrderValue: 0 },
        orders: data.orders || { total: 0, delivered: 0, cancelled: 0, avgDeliveryTime: 0 },
        drivers: data.drivers || { active: 0, totalDeliveries: 0, avgRating: 0, onTimeRate: 0 },
        topItems: data.topItems || [],
        hourlyDistribution: data.hourlyDistribution || [],
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp size={24} />
              Analytics Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Business intelligence and performance metrics
            </Typography>
          </Box>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
              <MenuItem value="90days">Last 90 Days</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
        <>
        {/* Revenue Metrics */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Revenue Overview
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AttachMoneyIcon color="success" />
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold">
                    ${analytics.revenue.total.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    ↑ {analytics.revenue.growth}% from last period
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <RestaurantIcon color="primary" />
                    <Typography color="text.secondary" variant="body2">
                      Total Orders
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold">
                    {analytics.revenue.orders}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    orders completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AttachMoneyIcon color="info" />
                    <Typography color="text.secondary" variant="body2">
                      Avg Order Value
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold">
                    ${analytics.revenue.avgOrderValue}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    per order
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUpIcon color="warning" />
                    <Typography color="text.secondary" variant="body2">
                      Growth Rate
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {analytics.revenue.growth}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    vs last period
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          {/* Orders Performance */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Order Performance
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                    <Typography variant="h3" fontWeight="bold" color="success.dark">
                      {analytics.orders.delivered}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      Delivered
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
                    <Typography variant="h3" fontWeight="bold" color="error.dark">
                      {analytics.orders.cancelled}
                    </Typography>
                    <Typography variant="body2" color="error.dark">
                      Cancelled
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ mt: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccessTimeIcon color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Average Delivery Time
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight="bold">
                        {analytics.orders.avgDeliveryTime} min
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Driver Performance */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Driver Performance
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LocalShippingIcon color="primary" />
                        <Typography variant="body2" color="text.secondary">
                          Active Drivers
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight="bold">
                        {analytics.drivers.active}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <RestaurantIcon color="info" />
                        <Typography variant="body2" color="text.secondary">
                          Total Deliveries
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight="bold">
                        {analytics.drivers.totalDeliveries}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <StarIcon color="warning" />
                        <Typography variant="body2" color="text.secondary">
                          Avg Rating
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight="bold">
                        {analytics.drivers.avgRating} ⭐
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccessTimeIcon color="success" />
                        <Typography variant="body2" color="text.secondary">
                          On-Time Rate
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight="bold" color="success.main">
                        {analytics.drivers.onTimeRate}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Top Menu Items */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Top Menu Items
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {analytics.topItems.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    mb: 1,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {index + 1}. {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.orders} orders
                    </Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    ${item.revenue.toFixed(2)}
                  </Typography>
                </Box>
              ))}
              {analytics.topItems.length === 0 && (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No item data available for this time range.
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Hourly Order Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Peak Hours
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {analytics.hourlyDistribution.map((slot, index) => {
                const maxOrders = Math.max(...analytics.hourlyDistribution.map(s => s.orders), 1);
                return (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{slot.hour}</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {slot.orders} orders
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 8,
                      bgcolor: 'grey.200',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(slot.orders / maxOrders) * 100}%`,
                        height: '100%',
                        bgcolor: 'primary.main',
                        transition: 'width 0.3s',
                      }}
                    />
                  </Box>
                </Box>
                );
              })}
              {analytics.hourlyDistribution.length === 0 && (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No hourly data available for this time range.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
        </>
        )}
      </Container>
    </Box>
  );
};

export default Analytics;
