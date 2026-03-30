import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import { Clock3, CookingPot, CheckCircle2, PackageCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

/**
 * Order Stats Component
 * Displays statistical overview of orders
 */
const OrderStats = ({ orders, viewMode, selectedOrderId, onSelectOrder }) => {
  const { stats, hourlySeries } = useMemo(() => {
    const statusCounts = {
      pending: 0,
      preparing: 0,
      ready: 0,
      assigned: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };

    orders.forEach(order => {
      if (statusCounts.hasOwnProperty(order.status)) {
        statusCounts[order.status]++;
      }
    });

    const activeOrders = statusCounts.pending + statusCounts.preparing + statusCounts.ready + statusCounts.assigned + statusCounts.out_for_delivery;
    const totalOrders = orders.length;

    const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      count: 0,
    }));

    const now = new Date();
    const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    orders.forEach((order) => {
      if (!order.created_at) {
        return;
      }

      const created = new Date(order.created_at);
      const createdKey = `${created.getUTCFullYear()}-${created.getUTCMonth()}-${created.getUTCDate()}`;
      if (createdKey === todayKey) {
        hourBuckets[created.getUTCHours()].count += 1;
      }
    });

    return {
      stats: {
        ...statusCounts,
        activeOrders,
        totalOrders,
      },
      hourlySeries: hourBuckets.filter((bucket, index) => index % 2 === 0),
    };
  }, [orders]);

  const statCards = [
    {
      label: 'Pending',
      value: stats.pending,
      icon: Clock3,
      color: '#F59E0B',
      background: 'rgba(245, 158, 11, 0.12)',
    },
    {
      label: 'Preparing',
      value: stats.preparing,
      icon: CookingPot,
      color: '#3B82F6',
      background: 'rgba(59, 130, 246, 0.12)',
    },
    {
      label: 'Ready',
      value: stats.ready,
      icon: CheckCircle2,
      color: '#10B981',
      background: 'rgba(16, 185, 129, 0.12)',
    },
    {
      label: 'Delivered',
      value: stats.delivered,
      icon: PackageCheck,
      color: '#64748B',
      background: 'rgba(100, 116, 139, 0.16)',
    },
  ];

  const trackedOrders = useMemo(
    () => orders
      .filter((order) => ['assigned', 'out_for_delivery', 'delivered'].includes(order.status))
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      }),
    [orders]
  );

  return (
    <Stack spacing={2} sx={{ minHeight: 'fit-content', pb: 1 }}>
      {/* Summary Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Order Summary
          </Typography>
          
          <Box sx={{ my: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}>
              <Typography variant="body2" color="text.secondary">
                Active Orders
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">
                {stats.activeOrders}
              </Typography>
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Typography variant="body2" color="text.secondary">
                Total Orders
              </Typography>
              <Typography variant="h6" fontWeight="medium">
                {stats.totalOrders}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155', fontWeight: 700 }}>
            Delivery Route Tracker
          </Typography>
          {trackedOrders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No assigned or delivered orders yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {trackedOrders.slice(0, 8).map((order) => (
                <Box
                  key={order.id}
                  sx={{
                    p: 0.85,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: selectedOrderId === order.id ? '#2563EB' : '#E2E8F0',
                    bgcolor: selectedOrderId === order.id ? 'rgba(37,99,235,0.08)' : '#FFFFFF',
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 0.75,
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                      Order #{order.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                      {order.status.replaceAll('_', ' ')}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={selectedOrderId === order.id ? 'contained' : 'outlined'}
                    onClick={() => onSelectOrder?.(order.id)}
                    sx={{
                      borderRadius: 999,
                      textTransform: 'none',
                      minWidth: 74,
                      px: 1.1,
                      py: 0.25,
                      fontSize: '0.7rem',
                      lineHeight: 1.1,
                      fontWeight: 700,
                      flexShrink: 0,
                      alignSelf: { xs: 'flex-end', sm: 'center' },
                      color: selectedOrderId === order.id ? '#FFFFFF' : '#1E3A8A',
                      bgcolor: selectedOrderId === order.id ? '#1D4ED8' : '#EFF6FF',
                      borderColor: selectedOrderId === order.id ? '#1D4ED8' : '#93C5FD',
                      '&:hover': {
                        bgcolor: selectedOrderId === order.id ? '#1E40AF' : '#DBEAFE',
                        borderColor: '#60A5FA',
                      },
                    }}
                  >
                    Route
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} sx={{ overflow: 'visible' }}>
            <CardContent sx={{ py: 1.25, overflow: 'visible', '&:last-child': { pb: 1.25 } }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 0.75, sm: 1 },
                width: '100%',
                minHeight: 28,
                overflow: 'visible',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, width: '100%', pb: '2px', overflow: 'visible' }}>
                  <Icon size={16} color={stat.color} />
                  <Typography variant="body1" fontWeight="medium" sx={{ lineHeight: 1.55 }}>
                    {stat.label}
                  </Typography>
                </Box>
                <Chip 
                  label={stat.value}
                  size="small"
                  sx={{
                    bgcolor: stat.background,
                    color: stat.color,
                    borderRadius: 999,
                    minWidth: 40,
                    flexShrink: 0,
                    alignSelf: { xs: 'flex-end', sm: 'center' },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155', fontWeight: 700 }}>
            Today's Orders by Hour
          </Typography>
          <Box sx={{ width: '100%', height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={hourlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} interval={3} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                  formatter={(value) => [value, 'Orders']}
                  labelFormatter={(label) => `Hour ${label}`}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* View Mode Info */}
      <Card
        sx={{
          mt: 1,
          border: '1px solid #D7E3F4',
          bgcolor: '#FFFFFF',
          boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
        }}
      >
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography variant="caption" display="block" sx={{ color: '#64748B', fontWeight: 700, letterSpacing: 0.25 }} gutterBottom>
            CURRENT VIEW
          </Typography>
          <Typography variant="body1" fontWeight={800} sx={{ color: '#0F172A', lineHeight: 1.2 }}>
            {viewMode === 'live' ? 'Live Order Tracking' : 'Historical Hotspots'}
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1, color: '#334155', lineHeight: 1.35 }}>
            {viewMode === 'live'
              ? 'Showing current active delivery locations'
              : 'Showing predicted high-demand areas based on historical data'}
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default OrderStats;
