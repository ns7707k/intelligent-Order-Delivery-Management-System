import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  List,
  ListItem,
  Stack,
  Typography,
} from '@mui/material';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { formatCurrencyGBP } from '../../utils/currency';
import api from '../../services/api';

const createPointIcon = (bg, text) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${text}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pickupIcon = createPointIcon('#2563EB', 'P');
const dropoffIcon = createPointIcon('#10B981', 'D');

function DriverDeliveryView() {
  const [collecting, setCollecting] = useState(false);

  const handleCollectCash = async () => {
    setCollecting(true);
    setError('');
    try {
      await api.collectCash(orderId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to collect cash');
    } finally {
      setCollecting(false);
    }
  };

  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get(`/driver/me/orders/${orderId}`);
      setOrder(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load order');
    }
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const navigateUrl = order
    ? `https://www.google.com/maps/dir/?api=1${order.pickup_latitude && order.pickup_longitude ? `&origin=${order.pickup_latitude},${order.pickup_longitude}` : ''}&destination=${order.latitude},${order.longitude}`
    : null;

  const pickupPoint = order && Number.isFinite(Number(order.pickup_latitude)) && Number.isFinite(Number(order.pickup_longitude))
    ? [Number(order.pickup_latitude), Number(order.pickup_longitude)]
    : null;
  const dropoffPoint = order && Number.isFinite(Number(order.latitude)) && Number.isFinite(Number(order.longitude))
    ? [Number(order.latitude), Number(order.longitude)]
    : null;
  const routePath = pickupPoint && dropoffPoint ? [pickupPoint, dropoffPoint] : [];
  const mapCenter = pickupPoint || dropoffPoint || [51.5074, -0.1278];

  const markDelivered = async () => {
    try {
      await api.patch(`/driver/me/orders/${orderId}/deliver`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to mark delivered');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3, pb: 11 }}>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Delivery #{order?.id}</Typography>
          <Typography color="text.secondary">Pickup and dropoff route for this active order.</Typography>
        </Box>
        <Chip label={(order?.status || 'pending').toUpperCase()} color={order?.status === 'delivered' ? 'success' : 'primary'} />
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }}>
                <Typography sx={{ fontWeight: 700, color: '#0F172A' }}>Route Map</Typography>
                <Typography variant="body2" color="text.secondary">P = Pickup | D = Delivery</Typography>
              </Box>
              <Box sx={{ height: 400 }}>
                <MapContainer key={`${mapCenter[0]}-${mapCenter[1]}`} center={mapCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {pickupPoint ? <Marker position={pickupPoint} icon={pickupIcon} /> : null}
                  {dropoffPoint ? <Marker position={dropoffPoint} icon={dropoffIcon} /> : null}
                  {routePath.length === 2 ? <Polyline positions={routePath} pathOptions={{ color: '#3B82F6', weight: 4 }} /> : null}
                </MapContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Delivery Details</Typography>
                <Typography sx={{ mt: 1 }}><strong>Customer:</strong> {order?.customer_name}</Typography>
                <Typography><strong>Phone:</strong> {order?.customer_phone || '-'}</Typography>
                <Typography><strong>Pickup:</strong> {order?.pickup_address || 'Restaurant pickup'}</Typography>
                <Typography><strong>Dropoff:</strong> {order?.delivery_address}</Typography>
                <Typography><strong>ETA:</strong> {order?.estimated_delivery_minutes || '-'} min</Typography>
                <Typography><strong>Earnings:</strong> {formatCurrencyGBP(order?.delivery_fee || 4.99)}</Typography>
                <Typography><strong>Payment Method:</strong> {order?.payment_method}</Typography>
                <Typography><strong>Payment Status:</strong> {order?.payment_status}</Typography>
                <Box sx={{ mt: 1.2 }}>
                  <Button size="small" onClick={() => navigator.clipboard.writeText(order?.delivery_address || '')}>Copy address</Button>
                  <Button size="small" component="a" href={`tel:${order?.customer_phone || ''}`}>Call customer</Button>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700}>Items</Typography>
                <List sx={{ py: 0 }}>
                  {(order?.items || []).map((item) => (
                    <ListItem key={item.id} sx={{ px: 0 }}>{item.quantity}x {item.name}</ListItem>
                  ))}
                </List>
                <Typography><strong>Notes:</strong> {order?.notes || 'None'}</Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Box sx={{ position: 'fixed', bottom: 74, left: 16, right: 16, display: 'flex', gap: 1 }}>
        <Button fullWidth variant="outlined" sx={{ minHeight: 48 }} onClick={() => navigateUrl && window.open(navigateUrl, '_blank')}>Navigate</Button>
        {order?.payment_method === 'CASH' && order?.payment_status !== 'Paid' ? (
          <Button
            fullWidth
            variant="contained"
            color="warning"
            sx={{ minHeight: 48 }}
            onClick={handleCollectCash}
            disabled={collecting}
          >
            {collecting ? 'Collecting...' : 'Collect Cash'}
          </Button>
        ) : null}
        <Button fullWidth variant="contained" sx={{ minHeight: 48 }} onClick={markDelivered}>Mark Delivered</Button>
      </Box>
    </Container>
  );
}

export default DriverDeliveryView;
