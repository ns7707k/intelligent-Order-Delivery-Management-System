import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import { ArrowLeft, Edit, User, Phone, MapPin, Clock3, Truck, Receipt } from 'lucide-react';
import { getOrderById, updateOrderStatus } from '../../services/api';
import { formatDate, formatDurationHMS, getRemainingSeconds } from '../../utils/dateUtils';

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [nowTs, setNowTs] = useState(Date.now());
  const pickupEta = Number(order?.driver_pickup_eta);
  const deliveryEta = Number(order?.estimated_delivery_minutes);
  const availableEta = Number(order?.driver_available_again_minutes);
  const destinationLat = Number(order?.latitude);
  const destinationLng = Number(order?.longitude);
  const hasDestinationCoords = Number.isFinite(destinationLat) && Number.isFinite(destinationLng);
  const mapsUrl = hasDestinationCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`
    : null;
  const pickupSecondsLeft = getRemainingSeconds(order?.pickup_eta_at, nowTs, pickupEta);
  const deliverySecondsLeft = getRemainingSeconds(order?.estimated_delivery_at || order?.estimated_delivery, nowTs, deliveryEta);
  const availableSecondsLeft = getRemainingSeconds(order?.driver_available_at, nowTs, availableEta);
  const showEtaPanel = order && ['assigned', 'out_for_delivery'].includes(order.status)
    && (deliverySecondsLeft !== null)
    && (availableSecondsLeft !== null);

  const fetchOrderDetails = useCallback(async (options = {}) => {
    const { silent = false } = options;
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await getOrderById(orderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!order || !['assigned', 'out_for_delivery'].includes(order.status)) {
      return undefined;
    }

    const refreshId = window.setInterval(() => {
      fetchOrderDetails({ silent: true });
    }, 5000);

    return () => window.clearInterval(refreshId);
  }, [order, fetchOrderDetails]);

  const handleStatusChange = async () => {
    try {
      const updatedOrder = await updateOrderStatus(orderId, newStatus);
      setOrder((prev) => ({ ...prev, ...updatedOrder }));
      setStatusDialogOpen(false);
      setNewStatus('');
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'default',
      preparing: 'primary',
      ready: 'success',
      assigned: 'warning',
      out_for_delivery: 'secondary',
      delivered: 'info',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Loading order details...</Typography>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Order not found'}</Alert>
        <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            Order #{order.id}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            Detailed order and delivery information
          </Typography>
          <Chip label={order.status.toUpperCase()} color={getStatusColor(order.status)} />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={<Edit size={16} />}
            onClick={() => setStatusDialogOpen(true)}
          >
            Update Status
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Customer Information */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                <User size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Customer Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{order.customer_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">
                    <Phone size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    {order.customer_phone}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">{order.customer_email}</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Delivery Information */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                <MapPin size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Delivery Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1">{order.delivery_address}</Typography>
                  {mapsUrl ? (
                    <Button
                      size="small"
                      sx={{ mt: 1, px: 0 }}
                      onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open in Google Maps
                    </Button>
                  ) : null}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Estimated Delivery
                  </Typography>
                  <Typography variant="body1">
                    <Clock3 size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    {formatDate(order.estimated_delivery)}
                  </Typography>
                </Box>
                {order.driver_name && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Driver
                    </Typography>
                    <Typography variant="body1">
                      <Truck size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                      {order.driver_name} (ID: {order.driver_id})
                    </Typography>
                  </Box>
                )}
                {showEtaPanel && (
                  <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#F8FAFC' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      Arrives at restaurant in {formatDurationHMS(pickupSecondsLeft)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      Customer receives order {formatDurationHMS(deliverySecondsLeft)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      Driver available again {formatDurationHMS(availableSecondsLeft)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Order Items */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                <Receipt size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Order Items
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                {order.items.map((item) => (
                  <ListItem
                    key={item.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight="medium">
                          {item.quantity}x {item.name}
                        </Typography>
                      }
                      secondary={item.notes ? `Note: ${item.notes}` : null}
                    />
                    <Typography variant="body1" fontWeight="bold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              {/* Price Breakdown */}
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Subtotal</Typography>
                  <Typography variant="body2">${order.subtotal.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Tax</Typography>
                  <Typography variant="body2">${order.tax.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2">Delivery Fee</Typography>
                  <Typography variant="body2">${order.delivery_fee.toFixed(2)}</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="bold">
                    Total
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ${order.total.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment Method: {order.payment_method}
                  </Typography>
                  <Chip
                    label={order.payment_status}
                    color={order.payment_status === 'Paid' ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Additional Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Additional Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Order Created
                  </Typography>
                  <Typography variant="body2">{formatDate(order.created_at)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">{formatDate(order.updated_at)}</Typography>
                </Grid>
                {order.notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Special Instructions
                    </Typography>
                    <Typography variant="body2">{order.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        {/* Status Update Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              sx={{ mt: 2, minWidth: 250 }}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="preparing">Preparing</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} variant="contained" disabled={!newStatus}>
              Update
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default OrderDetails;
