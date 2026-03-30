import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllRestaurants, geocodeAddress, updateDriverLocation } from '../../services/api';
import DriverAffiliationApply from './DriverAffiliationApply';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import api from '../../services/api';

const createPointIcon = (bg, text) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${text}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pickupIcon = createPointIcon('#2563EB', 'P');
const dropoffIcon = createPointIcon('#10B981', 'D');
const driverIcon = createPointIcon('#F59E0B', 'Y');

function DriverDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const prevOrderIdRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get('/driver/me');
      const payload = res.data;
      const activeOrderId = payload?.active_order?.id;
      if (activeOrderId && prevOrderIdRef.current && prevOrderIdRef.current !== activeOrderId) {
        const beep = new Audio('data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
        beep.play().catch(() => {});
      }
      prevOrderIdRef.current = activeOrderId || null;
      setData(payload);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const driver = data?.driver;
  const activeOrder = data?.active_order;

  // Affiliation state
  const [restaurant, setRestaurant] = useState(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (driver?.restaurant_id) {
        try {
          // Try to get restaurant info from all restaurants (since /restaurants/:id may not exist)
          const all = await getAllRestaurants();
          const found = (all.restaurants || all).find(r => r.id === driver.restaurant_id);
          setRestaurant(found || null);
        } catch {
          setRestaurant(null);
        }
      } else {
        setRestaurant(null);
      }
    };
    fetchRestaurant();
  }, [driver?.restaurant_id]);

  const pickupPoint = useMemo(() => {
    if (!activeOrder) return null;
    const lat = Number(activeOrder.pickup_latitude);
    const lng = Number(activeOrder.pickup_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [activeOrder]);

  const dropoffPoint = useMemo(() => {
    if (!activeOrder) return null;
    const lat = Number(activeOrder.latitude);
    const lng = Number(activeOrder.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [activeOrder]);

  const driverPoint = useMemo(() => {
    const lat = Number(driver?.current_latitude);
    const lng = Number(driver?.current_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [driver]);

  const routePath = useMemo(() => {
    if (!pickupPoint || !dropoffPoint) return [];
    return [pickupPoint, dropoffPoint];
  }, [pickupPoint, dropoffPoint]);

  const mapCenter = useMemo(() => {
    if (driverPoint) return driverPoint;
    if (pickupPoint) return pickupPoint;
    if (dropoffPoint) return dropoffPoint;
    return [51.5074, -0.1278];
  }, [driverPoint, pickupPoint, dropoffPoint]);

  const stats = useMemo(() => ({
    deliveriesToday: driver?.total_deliveries || 0,
    earningsToday: ((driver?.total_deliveries || 0) * 4.99).toFixed(2),
    hoursActive: driver?.status === 'offline' ? '0.0' : '8.0',
  }), [driver]);

  // Location dialog state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const handleGoAvailable = () => {
    setLocationAddress('');
    setLocationError('');
    setLocationDialogOpen(true);
  };

  const handleLocationSubmit = async () => {
    if (!locationAddress.trim()) {
      setLocationError('Please enter your current address.');
      return;
    }
    setLocationLoading(true);
    setLocationError('');
    try {
      const geo = await geocodeAddress(locationAddress.trim());
      if (!geo || geo.lat == null || geo.lng == null) {
        setLocationError('Address not found. Try a more specific address.');
        setLocationLoading(false);
        return;
      }
      await updateDriverLocation(geo.lat, geo.lng);
      await api.patch('/driver/me/status', { status: 'available' });
      setLocationDialogOpen(false);
      await load();
    } catch (err) {
      setLocationError(err?.response?.data?.error || 'Failed to update location. Try again.');
    }
    setLocationLoading(false);
  };

  const updateStatus = async (status) => {
    if (status === 'available') {
      handleGoAvailable();
      return;
    }
    try {
      await api.patch('/driver/me/status', { status });
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to update status');
    }
  };

  const markDelivered = async () => {
    if (!activeOrder) return;
    try {
      await api.patch(`/driver/me/orders/${activeOrder.id}/deliver`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to mark delivered');
    }
  };

  const navigateUrl = activeOrder
    ? `https://www.google.com/maps/dir/?api=1&destination=${activeOrder.latitude},${activeOrder.longitude}`
    : null;

  return (
    <Box sx={{ bgcolor: '#EEF2F8', minHeight: '100vh' }}>
      {/* Header */}
      <Paper 
        elevation={2}
        sx={{ 
          p: 2.5,
          borderRadius: 0,
          zIndex: 10,
          background: 'linear-gradient(135deg, #0A0F1E 0%, #162647 100%)',
          color: '#FFFFFF',
          mb: 3,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Driver Dashboard
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)' }}>
                Track your active delivery and route in real time.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: 1 }}>
                <Chip
                  label={driver?.status === 'offline' ? 'Offline' : 'Available'}
                  color={driver?.status === 'offline' ? 'default' : 'success'}
                  sx={{ fontWeight: 700, fontSize: 16, px: 2, bgcolor: driver?.status === 'offline' ? '#64748B' : '#22C55E', color: '#fff' }}
                />
                <Button variant="outlined" sx={{ color: '#fff', borderColor: '#fff', ml: 1 }} onClick={() => updateStatus(driver?.status === 'offline' ? 'available' : 'offline')}>
                  {driver?.status === 'offline' ? 'Go Available' : 'Go Offline'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Paper>
      <Container maxWidth="lg" sx={{ py: 3 }}>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }}>
                <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>Active Route Map</Typography>
                <Typography variant="body2" color="text.secondary">P = Pickup, D = Delivery, Y = Your location</Typography>
              </Box>
              <Box sx={{ height: 360 }}>
                <MapContainer center={mapCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {pickupPoint ? <Marker position={pickupPoint} icon={pickupIcon} /> : null}
                  {dropoffPoint ? <Marker position={dropoffPoint} icon={dropoffIcon} /> : null}
                  {driverPoint ? <Marker position={driverPoint} icon={driverIcon} /> : null}
                  {routePath.length === 2 ? <Polyline positions={routePath} pathOptions={{ color: '#3B82F6', weight: 4 }} /> : null}
                </MapContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Card sx={{ borderRadius: 3, border: activeOrder ? '2px solid #3B82F6' : '1px solid #DDE7F6' }}>
              <CardContent>
                {!activeOrder && driver?.status === 'offline' ? (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>You are offline</Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>Switch to available to receive delivery assignments.</Typography>
                    <Button variant="contained" fullWidth onClick={() => updateStatus('available')}>Go Available</Button>
                  </>
                ) : null}

                {!activeOrder && driver?.status !== 'offline' ? (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#15803D' }}>Ready for Orders</Typography>
                    <Typography color="text.secondary">No active assignment yet. Stay online for new jobs.</Typography>
                  </>
                ) : null}

                {activeOrder ? (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Active Delivery</Typography>
                    <Typography sx={{ mt: 0.8 }}><strong>Order:</strong> #{activeOrder.id}</Typography>
                    <Typography variant="body2" color="text.secondary"><strong>Pickup:</strong> {activeOrder.pickup_address || 'Restaurant pickup point'}</Typography>
                    <Typography variant="body2" color="text.secondary"><strong>Dropoff:</strong> {activeOrder.delivery_address}</Typography>
                    <Typography variant="body2" color="text.secondary"><strong>ETA:</strong> {activeOrder.estimated_delivery_minutes || '-'} min</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}><strong>Earnings:</strong> £{activeOrder.delivery_fee || 4.99}</Typography>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Button fullWidth variant="outlined" onClick={() => navigate('/driver/delivery/' + activeOrder.id)}>Open</Button>
                      </Grid>
                      <Grid item xs={6}>
                        <Button fullWidth variant="contained" onClick={markDelivered}>Delivered</Button>
                      </Grid>
                      {navigateUrl ? (
                        <Grid item xs={12}>
                          <Button fullWidth variant="text" onClick={() => window.open(navigateUrl, '_blank')}>Open Navigation</Button>
                        </Grid>
                      ) : null}
                    </Grid>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Today</Typography>
                <Typography>Deliveries: {stats.deliveriesToday}</Typography>
                <Typography>Earnings: £{stats.earningsToday}</Typography>
                <Typography>Hours active: {stats.hoursActive}</Typography>
              </CardContent>
            </Card>

            {/* Affiliation Status */}
            <Card sx={{ borderRadius: 3, bgcolor: restaurant ? '#F1F5F9' : '#FEF3C7' }}>
              <CardContent>
                {restaurant ? (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">Affiliated Restaurant</Typography>
                    <Typography variant="h6" fontWeight={700}>{restaurant.name}</Typography>
                    <Typography color="text.secondary">{restaurant.address}</Typography>
                    <Typography color="text.secondary">Contact: {restaurant.phone || '-'} | {restaurant.email || '-'}</Typography>
                  </>
                ) : (
                  <>
                    <Typography color="#92400E">You are not affiliated with any restaurant.</Typography>
                    <Box sx={{ mt: 2 }}>
                      {/* Show apply for affiliation UI here */}
                      <DriverAffiliationApply onApplied={load} />
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>

    {/* Location dialog — shown before going available */}
    <Dialog open={locationDialogOpen} onClose={() => !locationLoading && setLocationDialogOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Share Your Current Location</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your current address so the system can assign nearby orders to you.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Your current address"
          placeholder="e.g. 10 Baker Street, London"
          value={locationAddress}
          onChange={e => setLocationAddress(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !locationLoading && handleLocationSubmit()}
          disabled={locationLoading}
          error={!!locationError}
          helperText={locationError}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setLocationDialogOpen(false)} disabled={locationLoading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleLocationSubmit}
          disabled={locationLoading || !locationAddress.trim()}
          startIcon={locationLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {locationLoading ? 'Locating...' : 'Go Available'}
        </Button>
      </DialogActions>
    </Dialog>
    </Box>
  );
}

export default DriverDashboard;
