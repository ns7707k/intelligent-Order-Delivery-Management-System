import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Plus,
  Truck,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Eye,
  RefreshCcw,
  MapPin,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { getDrivers, updateDriver, deleteDriver, getAnalyticsSummary, registerDriverAccount } from '../../services/api';
import { formatDurationHMS, getRemainingSeconds } from '../../utils/dateUtils';

const DriverManagement = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [driverCredentials, setDriverCredentials] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    vehicle_type: 'Car',
    vehicle_number: '',
    status: 'available',
  });

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getDrivers();
      setDrivers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      setError('Failed to load drivers. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const data = await getAnalyticsSummary('today');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      // Set default analytics if fetch fails
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    fetchAnalytics();
  }, [fetchDrivers, fetchAnalytics]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const handleOpenDialog = (driver = null) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        name: driver.name || '',
        phone: driver.phone || '',
        email: driver.email || '',
        vehicle_type: driver.vehicle_type || 'Car',
        vehicle_number: driver.vehicle_number || '',
        status: driver.status || 'available',
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        vehicle_type: 'Car',
        vehicle_number: '',
        status: 'available',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDriver(null);
  };

  const handleSaveDriver = async () => {
    if (!formData.name || !formData.phone) {
      setError('Name and phone are required.');
      return;
    }
    if (!editingDriver && !formData.email) {
      setError('Email is required to create driver login credentials.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      if (editingDriver) {
        await updateDriver(editingDriver.id, formData);
        setSuccessMsg('Driver updated successfully.');
      } else {
        const result = await registerDriverAccount({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          vehicle_type: formData.vehicle_type,
          vehicle_number: formData.vehicle_number,
          password: '',
        });
        setSuccessMsg('Driver account created successfully.');
        if (!result?.temp_password) {
          setError('Driver created, but temporary password was not returned. Please try again.');
          return;
        }
        setDriverCredentials({
          driverName: result.driver?.name || formData.name,
          email: result.user?.email || formData.email,
          tempPassword: result.temp_password,
        });
      }
      handleCloseDialog();
      await fetchDrivers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save driver:', err);
      setError(err?.response?.data?.error || 'Failed to save driver.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDriver = async (driverId) => {
    if (window.confirm('Are you sure you want to delete this driver?')) {
      try {
        setError('');
        await deleteDriver(driverId);
        setSuccessMsg('Driver deleted successfully.');
        await fetchDrivers();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error('Failed to delete driver:', err);
        setError(err?.response?.data?.error || 'Failed to delete driver.');
      }
    }
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

  const getStatusAccent = (status) => {
    if (status === 'available') return '#10B981';
    if (status === 'on_delivery') return '#F59E0B';
    if (status === 'returning') return '#3B82F6';
    return '#64748B';
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const availableCount = drivers.filter(d => d.status === 'available').length;

  const getReturnCountdownSeconds = (driver) => {
    const availableAt = driver.driver_available_at || driver.estimated_return_at;
    if (!availableAt) {
      return null;
    }

    const target = new Date(availableAt).getTime();
    if (Number.isNaN(target)) {
      return null;
    }

    const diffSeconds = Math.round((target - nowTs) / 1000);
    return diffSeconds > 0 ? diffSeconds : 0;
  };

  const getOwnerTypeColor = (ownerType) => {
    return ownerType === 'restaurant' ? 'primary' : 'secondary';
  };

  const getOwnerTypeLabel = (ownerType) => {
    return ownerType === 'restaurant' ? 'RESTAURANT' : 'PLATFORM';
  };

  const truncateAddress = (address, maxLength = 40) => {
    if (!address) return 'Unknown location';
    return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
  };

  const calculateElapsedSeconds = (driver) => {
    if (!driver.assigned_at) return 0;
    const assignedTime = new Date(driver.assigned_at).getTime();
    if (Number.isNaN(assignedTime)) return 0;
    return Math.floor((nowTs - assignedTime) / 1000);
  };

  const getDeliveryCountdownSeconds = (driver) => {
    return getRemainingSeconds(driver.estimated_delivery_at, nowTs);
  };

  const calculateEstimatedRoundTripSeconds = (driver) => {
    const deliverySeconds = getDeliveryCountdownSeconds(driver);
    const availableSeconds = getReturnCountdownSeconds(driver);
    if (deliverySeconds === null && availableSeconds === null) return 0;
    return Math.max(deliverySeconds || 0, availableSeconds || 0);
  };

  const getDeliveryProgress = (driver) => {
    const elapsedSeconds = calculateElapsedSeconds(driver);
    const estimatedSeconds = calculateEstimatedRoundTripSeconds(driver);
    if (estimatedSeconds === 0) return 0;
    const progress = (elapsedSeconds / estimatedSeconds) * 100;
    return Math.min(progress, 99); // Cap at 99%
  };

  const getCurrentStatusSection = (driver) => {
    if (driver.status === 'available') {
      return (
        <Box sx={{ my: 2, py: 1.5, borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
            ● Ready for dispatch
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5 }}>
            Location: At depot
          </Typography>
        </Box>
      );
    } else if (driver.status === 'on_delivery') {
      const deliverySeconds = getDeliveryCountdownSeconds(driver);
      const availableSeconds = getReturnCountdownSeconds(driver);
      const progress = getDeliveryProgress(driver);
      return (
        <Box sx={{ my: 2, py: 1.5, borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="body2" sx={{ color: '#F59E0B', fontWeight: 600 }}>
            ● En Route — Order #{driver.current_order_id || 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5 }}>
            ETA to customer: {formatDurationHMS(deliverySeconds)}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
            Available again: {formatDurationHMS(availableSeconds)}
          </Typography>
          <Box sx={{ mt: 1, height: 6, bgcolor: '#E2E8F0', borderRadius: 1, overflow: 'hidden' }}>
            <Box 
              sx={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                bgcolor: '#F59E0B',
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
        </Box>
      );
    } else if (driver.status === 'returning') {
      const returnSeconds = getReturnCountdownSeconds(driver);
      return (
        <Box sx={{ my: 2, py: 1.5, borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="body2" sx={{ color: '#3B82F6', fontWeight: 600 }}>
            ● Returning to depot
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5 }}>
            Available in: {formatDurationHMS(returnSeconds)}
          </Typography>
        </Box>
      );
    } else {
      return (
        <Box sx={{ my: 2, py: 1.5, borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600 }}>
            ● Offline
          </Typography>
        </Box>
      );
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Driver Management
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Monitor fleet status, availability, and dispatch readiness
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshCcw size={16} />}
              onClick={fetchDrivers}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => handleOpenDialog()}
            >
              Add Driver
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMsg}
          </Alert>
        )}

        {/* Statistics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Drivers
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {drivers.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: availableCount > 0 ? '#ECFDF5' : '#FEF2F2' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Available Drivers
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight="bold"
                  sx={{ color: availableCount > 0 ? '#047857' : '#B91C1C' }}
                >
                  {availableCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Deliveries
                </Typography>
                <Typography variant="h3" fontWeight="bold" color="primary.main">
                  {drivers.reduce((sum, d) => sum + (d.active_deliveries || 0), 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Driver Cards */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : drivers.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No drivers found. Add your first driver to get started!
            </Typography>
          </Paper>
        ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 3,
            mb: 4,
          }}
        >
          {drivers.map((driver) => (
              <Card
                key={driver.id}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: `4px solid ${getStatusAccent(driver.status)}`,
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Header Row with Status and Owner Type Badges */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        mr: 2,
                        background: 'linear-gradient(135deg, #3B82F6 0%, #0A0F1E 100%)',
                      }}
                    >
                      {getInitials(driver.name)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {driver.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {driver.id}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Badges Row */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={driver.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(driver.status)}
                      size="small"
                    />
                    <Chip
                      label={getOwnerTypeLabel(driver.owner_type || 'restaurant')}
                      color={getOwnerTypeColor(driver.owner_type || 'restaurant')}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  {/* Contact Info */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone size={14} color="#6B7280" />
                      <Typography variant="body2">{driver.phone}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Mail size={14} color="#6B7280" />
                      <Typography variant="body2">{driver.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Truck size={14} color="#6B7280" />
                      <Typography variant="body2">
                        {driver.vehicle_type} - {driver.vehicle_number}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Current Status Section */}
                  {getCurrentStatusSection(driver)}

                  {/* Stats Row - 5 Stats */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 1,
                      mt: 2,
                      p: 1,
                      borderTop: '1px solid #E2E8F0',
                      bgcolor: '#F8FAFC',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Active
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {driver.active_deliveries}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Total
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {driver.total_deliveries}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        On-Time %
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {driver.total_deliveries > 0 ? Math.round(driver.on_time_rate || 0) : '--'}%
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Avg Time
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {driver.average_delivery_time ? Math.round(driver.average_delivery_time) : 0}m
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Rating
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        {driver.rating}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<Eye size={14} />}
                    onClick={() => navigate(`/drivers/${driver.id}`)}
                  >
                    View
                  </Button>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(driver)}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteDriver(driver.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
          ))}
        </Box>
        )}

        {/* Fleet Summary Panel */}
        {drivers.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Fleet Summary
            </Typography>
            
            <Grid container spacing={3}>
              {/* Section 1: Availability Timeline */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                  Availability Timeline (next 60 min)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {drivers.map((driver) => {
                    const returnSeconds = getReturnCountdownSeconds(driver);
                    const availabilityPercent = driver.status === 'available' 
                      ? 100 
                      : Math.max(0, (1 - (returnSeconds || 0) / 3600) * 100);
                    const barColor = driver.status === 'available' 
                      ? '#10B981' 
                      : returnSeconds !== null 
                        ? '#F59E0B' 
                        : '#E2E8F0';
                    
                    return (
                      <Box key={driver.id}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="caption" fontWeight="600">
                            {driver.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {driver.status === 'available' ? 'Available' : formatDurationHMS(returnSeconds)}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 8, bgcolor: '#E2E8F0', borderRadius: 1, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              height: '100%',
                              width: `${Math.min(availabilityPercent, 100)}%`,
                              bgcolor: barColor,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Grid>

              {/* Section 2: Today's Performance */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                  Today's Performance
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {analyticsLoading ? (
                    <CircularProgress size={24} />
                  ) : analytics ? (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Orders completed:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {analytics.orders?.total || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Total distance:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {analytics.distance_km !== undefined ? Math.round(analytics.distance_km * 10) / 10 : '--'} km
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Avg. delivery time:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {analytics.orders?.avgDeliveryTime 
                            ? Math.round(analytics.orders.avgDeliveryTime) 
                            : '--'} min
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Peak hour:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {analytics.hourlyDistribution && analytics.hourlyDistribution.length > 0
                            ? analytics.hourlyDistribution.reduce((max, curr) => 
                                curr.orders > max.orders ? curr : max
                              ).hour
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* Section 3: Driver Comparison */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                  Driver Comparison
                </Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Metric</TableCell>
                        {drivers.slice(0, 2).map((driver) => (
                          <TableCell key={driver.id} align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {driver.name.split(' ')[0]}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.85rem' }}>Total deliveries</TableCell>
                        {drivers.slice(0, 2).map((driver) => (
                          <TableCell key={driver.id} align="right" sx={{ fontSize: '0.85rem' }}>
                            {driver.total_deliveries}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.85rem' }}>On-time rate</TableCell>
                        {drivers.slice(0, 2).map((driver) => (
                          <TableCell key={driver.id} align="right" sx={{ fontSize: '0.85rem', color: 'success.main', fontWeight: 'bold' }}>
                            {driver.total_deliveries > 0 ? Math.round(driver.on_time_rate || 0) : '--'}%
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.85rem' }}>Avg. delivery time</TableCell>
                        {drivers.slice(0, 2).map((driver) => (
                          <TableCell key={driver.id} align="right" sx={{ fontSize: '0.85rem' }}>
                            {driver.average_delivery_time ? Math.round(driver.average_delivery_time) : 0} min
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.85rem' }}>Rating</TableCell>
                        {drivers.slice(0, 2).map((driver) => (
                          <TableCell key={driver.id} align="right" sx={{ fontSize: '0.85rem', color: 'warning.main', fontWeight: 'bold' }}>
                            {driver.rating}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Add/Edit Driver Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingDriver ? 'Edit Driver' : 'Add New Driver'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Driver Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  required
                  label="Vehicle Type"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                >
                  <MenuItem value="Car">Car</MenuItem>
                  <MenuItem value="Motorcycle">Motorcycle</MenuItem>
                  <MenuItem value="Bike">Bike</MenuItem>
                  <MenuItem value="Scooter">Scooter</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Vehicle Number"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="on_delivery">On Delivery</MenuItem>
                  <MenuItem value="returning">Returning</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveDriver} variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={24} /> : (editingDriver ? 'Save Changes' : 'Add Driver')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(driverCredentials)} onClose={() => setDriverCredentials(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Driver credentials generated</DialogTitle>
          <DialogContent>
            <Typography><strong>Name:</strong> {driverCredentials?.driverName}</Typography>
            <Typography><strong>Email:</strong> {driverCredentials?.email}</Typography>
            <Typography sx={{ mt: 1 }}><strong>Temporary Password:</strong> {driverCredentials?.tempPassword}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Share this once with the driver. They will be forced to change it on first login.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (!driverCredentials) return;
                navigator.clipboard.writeText(
                  `Email: ${driverCredentials.email}\nTemporary Password: ${driverCredentials.tempPassword}`
                );
              }}
            >
              Copy
            </Button>
            <Button onClick={() => setDriverCredentials(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default DriverManagement;
