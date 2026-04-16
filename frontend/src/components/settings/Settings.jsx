import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { getRestaurant, registerRestaurant, updateRestaurant, getSettings, updateSettings, registerDriverAccount, geocodeAddress } from '../../services/api';

const SETTINGS_CACHE_KEY = 'odms_settings_cache';

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteVehicle, setInviteVehicle] = useState('Motorcycle');
  const [inviteResult, setInviteResult] = useState(null);
  const [resolvingRestaurantAddress, setResolvingRestaurantAddress] = useState(false);

  // Restaurant data (tab 0)
  const [restaurant, setRestaurant] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    latitude: '',
    longitude: '',
    opens_at: '09:00',
    closes_at: '23:00',
    max_delivery_radius_km: 15,
    avg_speed_kmh: 30,
  });

  // Other settings (tabs 1-4)
  const [settings, setSettings] = useState({
    voice_confidence_threshold: 0.8,
    voice_auto_start: true,
    voice_confirmation_required: true,
    default_map_zoom: 13,
    map_style: 'standard',
    show_heatmap_by_default: false,
    default_delivery_fee: 4.99,
    tax_rate: 8.0,
    auto_assign_drivers: true,
    use_platform_drivers: false,
    allow_driver_self_delivery: true,
    order_timeout_minutes: 30,
    refresh_interval: 5,
    max_active_drivers: 20,
    enable_analytics: true,
    data_retention_days: 90,
  });

  const cacheSettings = (nextSettings) => {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextSettings));
    } catch {
      // Ignore cache write failures.
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load restaurant
        try {
          const data = await getRestaurant();
          if (data) {
            setIsRegistered(true);
            setRestaurant({
              name: data.name || '',
              phone: data.phone || '',
              email: data.email || '',
              address: data.address || '',
              latitude: data.latitude ?? '',
              longitude: data.longitude ?? '',
              opens_at: data.opens_at || '09:00',
              closes_at: data.closes_at || '23:00',
              max_delivery_radius_km: data.max_delivery_radius_km ?? 15,
              avg_speed_kmh: data.avg_speed_kmh ?? 30,
            });
          }
        } catch (err) {
          console.error('Failed to load restaurant:', err);
        }
        // Load settings
        try {
          const settingsData = await getSettings();
          if (settingsData && typeof settingsData === 'object') {
            setSettings(prev => {
              const merged = {
                ...prev,
                voice_confidence_threshold: settingsData.voice_confidence_threshold ?? prev.voice_confidence_threshold,
                voice_auto_start: settingsData.voice_auto_start ?? prev.voice_auto_start,
                voice_confirmation_required: settingsData.voice_confirmation_required ?? prev.voice_confirmation_required,
                default_map_zoom: settingsData.default_map_zoom ?? prev.default_map_zoom,
                map_style: settingsData.map_style ?? prev.map_style,
                show_heatmap_by_default: settingsData.show_heatmap_by_default ?? prev.show_heatmap_by_default,
                default_delivery_fee: settingsData.default_delivery_fee ?? prev.default_delivery_fee,
                tax_rate: settingsData.tax_rate ?? prev.tax_rate,
                auto_assign_drivers: settingsData.auto_assign_drivers ?? prev.auto_assign_drivers,
                use_platform_drivers: settingsData.use_platform_drivers ?? prev.use_platform_drivers,
                allow_driver_self_delivery: settingsData.allow_driver_self_delivery ?? prev.allow_driver_self_delivery,
                order_timeout_minutes: settingsData.order_timeout_minutes ?? prev.order_timeout_minutes,
                refresh_interval: settingsData.refresh_interval ?? prev.refresh_interval,
                max_active_drivers: settingsData.max_active_drivers ?? prev.max_active_drivers,
                enable_analytics: settingsData.enable_analytics ?? prev.enable_analytics,
                data_retention_days: settingsData.data_retention_days ?? prev.data_retention_days,
              };

              cacheSettings(merged);
              return merged;
            });
          }
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRestaurantChange = (field, value) => {
    setRestaurant({ ...restaurant, [field]: value });
  };

  const handleSettingsChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const resolveRestaurantCoordinates = async () => {
    if (!restaurant.address?.trim()) {
      setError('Please enter restaurant address first.');
      return null;
    }

    setResolvingRestaurantAddress(true);
    try {
      const geo = await geocodeAddress(restaurant.address.trim());
      const resolvedLat = geo?.lat;
      const resolvedLng = geo?.lng;

      if (resolvedLat == null || resolvedLng == null) {
        setError('Could not resolve coordinates from address.');
        return null;
      }

      setRestaurant((prev) => ({
        ...prev,
        address: geo.display_address || prev.address,
        latitude: resolvedLat,
        longitude: resolvedLng,
      }));

      return {
        lat: resolvedLat,
        lng: resolvedLng,
      };
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to resolve restaurant address.');
      return null;
    } finally {
      setResolvingRestaurantAddress(false);
    }
  };

  const handleSaveRestaurant = async () => {
    setError('');
    if (!restaurant.name || !restaurant.address?.trim()) {
      setError('Restaurant name and address are required.');
      return;
    }
    try {
      let latitude = restaurant.latitude;
      let longitude = restaurant.longitude;

      const hasCoords = latitude !== '' && latitude != null && longitude !== '' && longitude != null;
      if (!hasCoords) {
        const resolved = await resolveRestaurantCoordinates();
        if (!resolved) {
          return;
        }
        latitude = resolved.lat;
        longitude = resolved.lng;
      }

      const payload = {
        ...restaurant,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        max_delivery_radius_km: parseFloat(restaurant.max_delivery_radius_km),
        avg_speed_kmh: parseFloat(restaurant.avg_speed_kmh),
      };
      if (isRegistered) {
        await updateRestaurant(payload);
      } else {
        await registerRestaurant(payload);
        setIsRegistered(true);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save restaurant settings.');
    }
  };

  const handleSave = async () => {
    if (tabValue === 0) {
      handleSaveRestaurant();
    } else {
      setError('');
      try {
        await updateSettings(settings);
        cacheSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to save settings.');
      }
    }
  };

  const handleCreateDriverInvite = async () => {
    setError('');
    if (!inviteEmail || !inviteName || !invitePhone) {
      setError('Driver invite requires name, email, and phone.');
      return;
    }
    try {
      const res = await registerDriverAccount({
        email: inviteEmail,
        name: inviteName,
        phone: invitePhone,
        vehicle_type: inviteVehicle,
      });
      setInviteResult({
        email: inviteEmail,
        password: res.temp_password,
      });
      setInviteEmail('');
      setInviteName('');
      setInvitePhone('');
      setInviteVehicle('Motorcycle');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create driver account.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight="bold">
              <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Settings
            </Typography>
            {isRegistered ? (
              <Chip label="Restaurant Registered" color="success" size="small" variant="outlined" />
            ) : (
              <Chip label="Setup Required" color="warning" size="small" />
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Box>

        {saved && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings saved successfully!
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!isRegistered && tabValue !== 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Please complete restaurant registration first (Restaurant tab) to enable delivery features.
          </Alert>
        )}

        <Paper>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Restaurant" />
            <Tab label="Voice System" />
            <Tab label="Map & Routes" />
            <Tab label="Orders" />
            <Tab label="System" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Restaurant Tab */}
            {tabValue === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    <StorefrontIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Restaurant Registration
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Your restaurant location serves as the depot for all delivery routes.
                    Drivers depart from here and return after each delivery.
                  </Typography>
                  <Divider sx={{ mb: 2, mt: 1 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    label="Restaurant Name"
                    value={restaurant.name}
                    onChange={(e) => handleRestaurantChange('name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={restaurant.email}
                    onChange={(e) => handleRestaurantChange('email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={restaurant.phone}
                    onChange={(e) => handleRestaurantChange('phone', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Address"
                    value={restaurant.address}
                    onChange={(e) => handleRestaurantChange('address', e.target.value)}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={resolveRestaurantCoordinates}
                      disabled={resolvingRestaurantAddress || !restaurant.address?.trim()}
                    >
                      {resolvingRestaurantAddress ? 'Resolving...' : 'Resolve Coordinates From Address'}
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>
                    <LocationOnIcon sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.2rem' }} />
                    Restaurant Location (GPS)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    This is the depot for VRP - all delivery/return ETAs are calculated from here.
                    Get coordinates from Google Maps (right-click -&gt; "What's here?").
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Latitude"
                    value={restaurant.latitude}
                    onChange={(e) => handleRestaurantChange('latitude', e.target.value)}
                    inputProps={{ step: '0.000001' }}
                    placeholder="e.g. 28.6139"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Longitude"
                    value={restaurant.longitude}
                    onChange={(e) => handleRestaurantChange('longitude', e.target.value)}
                    inputProps={{ step: '0.000001' }}
                    placeholder="e.g. 77.2090"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Opens At"
                    value={restaurant.opens_at}
                    onChange={(e) => handleRestaurantChange('opens_at', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Closes At"
                    value={restaurant.closes_at}
                    onChange={(e) => handleRestaurantChange('closes_at', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>
                    Delivery Configuration
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Delivery Radius (km)"
                    value={restaurant.max_delivery_radius_km}
                    onChange={(e) => handleRestaurantChange('max_delivery_radius_km', e.target.value)}
                    inputProps={{ min: 1, max: 50, step: 0.5 }}
                    helperText="Orders beyond this radius will be rejected"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Avg Driver Speed (km/h)"
                    value={restaurant.avg_speed_kmh}
                    onChange={(e) => handleRestaurantChange('avg_speed_kmh', e.target.value)}
                    inputProps={{ min: 5, max: 100, step: 1 }}
                    helperText="Used to calculate delivery and return ETAs"
                  />
                </Grid>
              </Grid>
            )}

            {/* Voice System Tab */}
            {tabValue === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Voice Recognition Settings
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <TextField
                        fullWidth
                        type="number"
                        label="Confidence Threshold"
                        value={settings.voice_confidence_threshold}
                        onChange={(e) => handleSettingsChange('voice_confidence_threshold', parseFloat(e.target.value))}
                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                        helperText="Minimum confidence score (0.0 - 1.0) required to accept voice commands. Default: 0.8"
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.voice_auto_start}
                        onChange={(e) => handleSettingsChange('voice_auto_start', e.target.checked)}
                      />
                    }
                    label="Auto-start voice recognition on Kitchen View load"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.voice_confirmation_required}
                        onChange={(e) => handleSettingsChange('voice_confirmation_required', e.target.checked)}
                      />
                    }
                    label="Require confirmation before updating orders"
                  />
                </Grid>
              </Grid>
            )}

            {/* Map & Routes Tab */}
            {tabValue === 2 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Map Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Default Map Zoom Level"
                    value={settings.default_map_zoom}
                    onChange={(e) => handleSettingsChange('default_map_zoom', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 20 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Map Style"
                    value={settings.map_style}
                    onChange={(e) => handleSettingsChange('map_style', e.target.value)}
                  >
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="satellite">Satellite</MenuItem>
                    <MenuItem value="terrain">Terrain</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.show_heatmap_by_default}
                        onChange={(e) => handleSettingsChange('show_heatmap_by_default', e.target.checked)}
                      />
                    }
                    label="Show heatmap by default on Dashboard"
                  />
                </Grid>
              </Grid>
            )}

            {/* Orders Tab */}
            {tabValue === 3 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Order Management
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Default Delivery Fee (GBP)"
                    value={settings.default_delivery_fee}
                    onChange={(e) => handleSettingsChange('default_delivery_fee', parseFloat(e.target.value))}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Tax Rate (%)"
                    value={settings.tax_rate}
                    onChange={(e) => handleSettingsChange('tax_rate', parseFloat(e.target.value))}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Order Timeout (minutes)"
                    value={settings.order_timeout_minutes}
                    onChange={(e) => handleSettingsChange('order_timeout_minutes', parseInt(e.target.value))}
                    inputProps={{ min: 5, max: 120 }}
                    helperText="Auto-cancel orders not accepted within this time"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.auto_assign_drivers}
                        onChange={(e) => handleSettingsChange('auto_assign_drivers', e.target.checked)}
                      />
                    }
                    label="Automatically assign drivers to ready orders"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.use_platform_drivers}
                        onChange={(e) => handleSettingsChange('use_platform_drivers', e.target.checked)}
                      />
                    }
                    label="Use Platform Drivers"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    When enabled, orders can be assigned to platform-managed drivers in addition to your own registered drivers.
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.allow_driver_self_delivery}
                        onChange={(e) => handleSettingsChange('allow_driver_self_delivery', e.target.checked)}
                      />
                    }
                    label="Allow drivers to self-mark deliveries"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    If disabled, drivers will see "Awaiting restaurant confirmation" when attempting to mark delivered.
                  </Typography>
                </Grid>
              </Grid>
            )}

            {/* System Tab */}
            {tabValue === 4 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    System Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Refresh Interval (seconds)"
                    value={settings.refresh_interval}
                    onChange={(e) => handleSettingsChange('refresh_interval', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 60 }}
                    helperText="How often to refresh order data"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Maximum Active Drivers"
                    value={settings.max_active_drivers}
                    onChange={(e) => handleSettingsChange('max_active_drivers', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 100 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Data Retention (days)"
                    value={settings.data_retention_days}
                    onChange={(e) => handleSettingsChange('data_retention_days', parseInt(e.target.value))}
                    inputProps={{ min: 30, max: 365 }}
                    helperText="How long to keep historical data"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enable_analytics}
                        onChange={(e) => handleSettingsChange('enable_analytics', e.target.checked)}
                      />
                    }
                    label="Enable analytics tracking"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Driver Invite
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Driver Name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Driver Email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Driver Phone"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Vehicle Type"
                    value={inviteVehicle}
                    onChange={(e) => setInviteVehicle(e.target.value)}
                  >
                    <MenuItem value="Motorcycle">Motorcycle</MenuItem>
                    <MenuItem value="Car">Car</MenuItem>
                    <MenuItem value="Bicycle">Bicycle</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" onClick={handleCreateDriverInvite}>
                    Create Driver Account
                  </Button>
                </Grid>
              </Grid>
            )}
          </Box>
        </Paper>

        <Dialog open={Boolean(inviteResult)} onClose={() => setInviteResult(null)}>
          <DialogTitle>Driver account created</DialogTitle>
          <DialogContent>
            <Typography>Email: {inviteResult?.email}</Typography>
            <Typography>Password: {inviteResult?.password}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Share these credentials with your driver.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (!inviteResult) return;
                navigator.clipboard.writeText(`Email: ${inviteResult.email}\nPassword: ${inviteResult.password}`);
              }}
            >
              Copy to clipboard
            </Button>
            <Button onClick={() => setInviteResult(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default Settings;
