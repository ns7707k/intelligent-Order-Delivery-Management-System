import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Divider,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowLeft, Edit, Phone, Mail, Truck, Star } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { getDriverById } from '../../services/api';

const DriverDetails = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDriver = async () => {
      try {
        setLoading(true);
        setError('');
        if (!driverId) {
          setError('No driver ID provided');
          setLoading(false);
          return;
        }
        const data = await getDriverById(driverId);
        if (!data) {
          setError(`Driver ${driverId} not found`);
          setLoading(false);
          return;
        }
        setDriver({
          ...data,
          deliveryHistory: data.deliveryHistory || [],
          performance: data.performance || {
            onTimeDeliveries: data.on_time_deliveries || 0,
            lateDeliveries: data.late_deliveries || 0,
            averageDeliveryTime: data.average_delivery_time || 0,
          },
        });
      } catch (err) {
        console.error('Failed to fetch driver:', err);
        setError(err?.response?.status === 404 
          ? `Driver not found (ID: ${driverId})`
          : 'Failed to load driver details. Please try again.'
        );
        setDriver(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDriver();
  }, [driverId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading driver details for {driverId}...
        </Typography>
      </Box>
    );
  }

  if (error || !driver) {
    return (
      <Container sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate('/drivers')} size="small">
            <ArrowLeft size={20} />
          </IconButton>
        </Box>
        <Alert severity="error">
          {error || `Driver ${driverId} could not be loaded. It may have been deleted or is temporarily unavailable.`}
        </Alert>
        <Button variant="contained" sx={{ mt: 3 }} onClick={() => navigate('/drivers')}>
          Back to Drivers
        </Button>
      </Container>
    );
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'success',
      on_delivery: 'warning',
      returning: 'info',
      offline: 'default',
    };
    return colors[status] || 'default';
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/drivers')}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            Driver Details
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            Profile, contact, and delivery history
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" startIcon={<Edit size={16} />}>
            Edit Profile
          </Button>
        </Box>

        {/* Profile Summary */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    fontSize: '3rem',
                    bgcolor: 'primary.main',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  {getInitials(driver.name)}
                </Avatar>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {driver.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Driver ID: {driver.id}
                </Typography>
                <Chip
                  label={driver.status.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(driver.status)}
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Phone Number
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone size={18} />
                    <Typography variant="body1">{driver.phone}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Email Address
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Mail size={18} />
                    <Typography variant="body1">{driver.email}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Vehicle Information
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Truck size={18} />
                    <Typography variant="body1">
                      {driver.vehicle_type} - {driver.vehicle_number}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    License Number
                  </Typography>
                  <Typography variant="body1">{driver.license_number}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1">{driver.address}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Emergency Contact
                  </Typography>
                  <Typography variant="body1">{driver.emergency_contact}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Joined Date
                  </Typography>
                  <Typography variant="body1">{formatDate(driver.joined_date)}</Typography>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Active Deliveries
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {driver.active_deliveries}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Total Deliveries
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {driver.total_deliveries}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Average Rating
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h4" fontWeight="bold">
                    {driver.rating}
                  </Typography>
                  <Star size={24} color="#FCD34D" fill="#FCD34D" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  On-Time Rate
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {driver.total_deliveries > 0 ? ((driver.performance.onTimeDeliveries / driver.total_deliveries) * 100).toFixed(1) : 100}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Delivery History" />
            <Tab label="Performance" />
          </Tabs>

          {/* Delivery History Tab */}
          {tabValue === 0 && (
            <Box sx={{ p: 3 }}>
              {driver.deliveryHistory.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={3}>
                  No delivery history found.
                </Typography>
              ) : (
              <List>
                {driver.deliveryHistory.map((delivery) => (
                  <ListItem
                    key={delivery.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                    secondaryAction={
                      <Typography variant="body1" fontWeight="bold">
                        ${parseFloat(delivery.amount || 0).toFixed(2)}
                      </Typography>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            Order #{delivery.id} - {delivery.customer}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {delivery.address}
                          </Typography>
                        </Box>
                      }
                      secondary={delivery.date ? formatDate(delivery.date) : 'N/A'}
                    />
                  </ListItem>
                ))}
              </List>
              )}
            </Box>
          )}

          {/* Performance Tab */}
          {tabValue === 1 && (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Delivery Performance
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>On-Time Deliveries</Typography>
                        <Typography fontWeight="bold" color="success.main">
                          {driver.performance.onTimeDeliveries}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Late Deliveries</Typography>
                        <Typography fontWeight="bold" color="error.main">
                          {driver.performance.lateDeliveries}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Avg. Delivery Time</Typography>
                        <Typography fontWeight="bold">
                          {driver.performance.averageDeliveryTime} min
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Customer Ratings
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h3" fontWeight="bold" color="warning.main">
                          {driver.rating || 5.0} ⭐
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Average rating from {driver.total_deliveries || 0} deliveries
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default DriverDetails;
