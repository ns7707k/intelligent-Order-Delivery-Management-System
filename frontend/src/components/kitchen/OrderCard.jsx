import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Divider,
  IconButton,
  LinearProgress,
} from '@mui/material';
import { Clock, MapPin, Eye, Bike } from 'lucide-react';
import { formatDistanceToNow, formatDurationHMS, getRemainingSeconds } from '../../utils/dateUtils';

/**
 * Order Card Component — Corporate Design
 * Status-aware card with clean visual hierarchy and driver + ETA info
 */
const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const earthRadius = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const OrderCard = ({ order, onStatusChange, onAssignDriver, restaurantLocation }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pickupEta = Number(order.driver_pickup_eta);
  const deliveryEta = Number(order.estimated_delivery_minutes);
  const availableEta = Number(order.driver_available_again_minutes);
  const estimatedDeliveryAt = order.estimated_delivery_at || order.estimated_delivery;
  const driverAvailableAt = order.driver_available_at;

  const deliverySecondsLeft = useMemo(
    () => getRemainingSeconds(estimatedDeliveryAt, now, deliveryEta),
    [estimatedDeliveryAt, deliveryEta, now]
  );

  const availableSecondsLeft = useMemo(
    () => getRemainingSeconds(driverAvailableAt, now, availableEta),
    [driverAvailableAt, availableEta, now]
  );

  const pickupSecondsLeft = useMemo(
    () => getRemainingSeconds(order.pickup_eta_at, now, pickupEta),
    [order.pickup_eta_at, now, pickupEta]
  );

  const hasEtaPanel = ['assigned', 'out_for_delivery'].includes(order.status)
    && (deliverySecondsLeft !== null)
    && (availableSecondsLeft !== null);

  const readyWaitingMinutes = useMemo(() => {
    if (order.status !== 'ready' || order.driver_id) {
      return 0;
    }
    const readyAtSource = order.updated_at || order.created_at;
    if (!readyAtSource) {
      return 0;
    }
    const readyAt = new Date(readyAtSource).getTime();
    if (Number.isNaN(readyAt)) {
      return 0;
    }
    return Math.max(0, Math.floor((now - readyAt) / 60000));
  }, [order.status, order.driver_id, order.updated_at, order.created_at, now]);

  const awaitingEtaMinutes = useMemo(() => {
    if (order.status !== 'ready' || order.driver_id || !order.driver_available_at) {
      return null;
    }
    const ts = new Date(order.driver_available_at).getTime();
    if (Number.isNaN(ts)) {
      return null;
    }
    const diff = Math.round((ts - now) / 60000);
    return diff > 0 ? diff : null;
  }, [order.status, order.driver_id, order.driver_available_at, now]);

  const showAssignDriverButton = order.status === 'ready' && !order.driver_id && readyWaitingMinutes >= 2;

  const distanceKm = useMemo(() => {
    const restaurantLat = Number(restaurantLocation?.[0]);
    const restaurantLng = Number(restaurantLocation?.[1]);
    const orderLat = Number(order.latitude);
    const orderLng = Number(order.longitude);

    if (![restaurantLat, restaurantLng, orderLat, orderLng].every(Number.isFinite)) {
      return null;
    }

    return haversineKm(restaurantLat, restaurantLng, orderLat, orderLng);
  }, [order.latitude, order.longitude, restaurantLocation]);

  const statusConfig = {
    pending:          { color: 'default',   label: 'Pending',         bg: '#F8FAFC', border: '#E2E8F0', accent: '#64748B' },
    preparing:        { color: 'warning',   label: 'Preparing',       bg: '#FFFBEB', border: '#FDE68A', accent: '#D97706' },
    ready:            { color: 'success',   label: 'Ready',           bg: '#ECFDF5', border: '#A7F3D0', accent: '#059669' },
    assigned:         { color: 'info',      label: 'Driver Assigned', bg: '#ECFEFF', border: '#A5F3FC', accent: '#0891B2' },
    out_for_delivery: { color: 'secondary', label: 'On Delivery',     bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB' },
    delivered:        { color: 'success',   label: 'Delivered',       bg: '#ECFDF5', border: '#A7F3D0', accent: '#059669' },
    cancelled:        { color: 'error',     label: 'Cancelled',       bg: '#FEF2F2', border: '#FECACA', accent: '#DC2626' },
  };

  const cfg = statusConfig[order.status] || statusConfig.pending;

  const getNextActions = (status) => {
    const actions = {
      pending: ['preparing'],
      preparing: ['ready', 'cancelled'],
      ready: [],
      assigned: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
    };
    return actions[status] || [];
  };

  const actionLabels = {
    preparing: 'Start Preparing',
    ready: 'Mark Ready',
    out_for_delivery: 'Out For Delivery',
    delivered: 'Mark Delivered',
    cancelled: 'Cancel',
  };

  const nextActions = getNextActions(order.status);

  return (
    <Card 
      className="card-hover"
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: cfg.border,
        borderTop: `3px solid ${cfg.accent}`,
        bgcolor: 'white',
        borderRadius: 3,
        overflow: 'hidden',
        '&:hover': { borderColor: cfg.accent },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
        {/* ─ Header: Order # + Status ─ */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ letterSpacing: '-0.02em' }}>
              #{order.id}
            </Typography>
            <IconButton
              size="small"
              onClick={() => navigate(`/orders/${order.id}`)}
              title="View Details"
              sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
            >
              <Eye size={16} />
            </IconButton>
          </Box>
          <Chip 
            label={cfg.label} 
            color={cfg.color}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          />
        </Box>

        {/* ─ Customer name ─ */}
        {order.customer_name && (
          <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1.5 }}>
            {order.customer_name}
          </Typography>
        )}

        {/* ─ Items ─ */}
        {order.items && order.items.length > 0 && (
          <Box sx={{ 
            mb: 2, 
            p: 1.5, 
            bgcolor: '#F8FAFC', 
            borderRadius: 2,
            border: '1px solid #F1F5F9',
          }}>
            {order.items.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.primary">
                  {item.name}
                </Typography>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  x{item.quantity}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* ─ Delivery Address ─ */}
        {order.delivery_address && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 1 }}>
            <MapPin size={15} style={{ color: 'var(--mui-palette-text-secondary)' }} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {order.delivery_address}
            </Typography>
          </Box>
        )}

        {/* ─ Timestamp ─ */}
        {order.created_at && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Clock size={14} style={{ color: 'var(--mui-palette-text-secondary)' }} />
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(order.created_at)}
            </Typography>
          </Box>
        )}

        {/* ─── Driver & ETA Info Panel ─── */}
        {order.driver_name && (
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            bgcolor: cfg.bg, 
            borderRadius: 2,
            border: `1px solid ${cfg.border}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Bike size={16} style={{ color: cfg.accent }} />
              <Typography variant="body2" fontWeight={700} color="text.primary">
                {order.driver_name}
              </Typography>
              {order.driver_status && (
                <Chip 
                  label={order.driver_status === 'on_delivery' ? 'On Delivery' 
                       : order.driver_status === 'returning' ? 'Returning'
                       : order.driver_status}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.65rem', 
                    height: 22,
                    borderColor: cfg.accent, 
                    color: cfg.accent,
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>

            {/* ETA */}
            {hasEtaPanel && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography variant="caption" fontWeight={700} color="text.primary">
                  {order.driver_name} ({order.driver_vehicle_type || 'Vehicle'})
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Arrives at restaurant in</Typography>
                  <Typography variant="caption" fontWeight={700} color={cfg.accent}>
                    {formatDurationHMS(pickupSecondsLeft)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Customer receives order</Typography>
                  <Typography variant="caption" fontWeight={700} color={cfg.accent}>
                    {formatDurationHMS(deliverySecondsLeft)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Driver available again</Typography>
                  <Typography variant="caption" fontWeight={700} color="text.primary">
                    {formatDurationHMS(availableSecondsLeft)}
                  </Typography>
                </Box>
              </Box>
            )}

            {distanceKm !== null && (
              <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Distance to customer</Typography>
                <Typography variant="caption" fontWeight={700} color="text.primary">
                  {distanceKm.toFixed(1)} km
                </Typography>
              </Box>
            )}

            {/* Progress bar for active deliveries */}
            {(order.status === 'out_for_delivery' || order.status === 'assigned') && (
              <LinearProgress 
                color={order.status === 'out_for_delivery' ? 'secondary' : 'info'} 
                sx={{ mt: 1.5, borderRadius: 2, height: 4 }}
              />
            )}
          </Box>
        )}
      </CardContent>

      {/* ─ Action Buttons ─ */}
      {nextActions.length > 0 && (
        <CardActions sx={{ p: 2, pt: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            {nextActions.map((action) => (
              <Button
                key={action}
                variant={action === 'cancelled' ? 'outlined' : 'contained'}
                color={action === 'cancelled' ? 'error' 
                     : action === 'out_for_delivery' ? 'secondary' 
                     : action === 'ready' ? 'success' 
                     : 'primary'}
                fullWidth
                size="medium"
                onClick={() => onStatusChange(action)}
                sx={{ 
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 1,
                }}
              >
                {actionLabels[action] || action}
              </Button>
            ))}
          </Box>
        </CardActions>
      )}

      {/* Ready orders waiting for auto-assignment */}
      {order.status === 'ready' && !order.driver_id && (
        <CardActions sx={{ p: 2, pt: 0, justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
          <Chip
            label={`Awaiting driver assignment...${awaitingEtaMinutes !== null ? ` ~${awaitingEtaMinutes}m` : ''}`}
            color="success"
            variant="outlined"
            size="small"
            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
          />
          {showAssignDriverButton && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onAssignDriver?.(order.id)}
              sx={{ borderRadius: 2, fontSize: '0.75rem' }}
            >
              Assign Driver
            </Button>
          )}
        </CardActions>
      )}

      {(order.driver_id || ['assigned', 'out_for_delivery', 'delivered'].includes(order.status)) && (
        <CardActions sx={{ p: 2, pt: 0 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate(`/dashboard?order=${order.id}`)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            View delivery route on map
          </Button>
        </CardActions>
      )}
    </Card>
  );
};

export default OrderCard;
