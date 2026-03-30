import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Building2, MapPin, ShieldCheck } from 'lucide-react';
import { registerRestaurant } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const steps = ['Account', 'Restaurant Details', 'Review'];

const pinIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#e53935;border:2px solid #fff;box-shadow:0 0 0 2px #e53935"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapPickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

function RestaurantRegistration() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    restaurant_name: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
  });

  const [addressSearch, setAddressSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      if (step !== 1 || !addressSearch.trim()) return;
      setGeocoding(true);
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(addressSearch)}`);
        if (res.ok) {
          const geo = await res.json();
          setFormData((prev) => ({
            ...prev,
            address: geo.display_address || addressSearch,
            latitude: geo.lat,
            longitude: geo.lng,
          }));
        }
      } catch {
        // Silent fallback to manual pin pick
      } finally {
        setGeocoding(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [addressSearch, step]);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (formData.password.length >= 8) score += 1;
    if (/[A-Z]/.test(formData.password)) score += 1;
    if (/\d/.test(formData.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(formData.password)) score += 1;
    return score;
  }, [formData.password]);

  const updateField = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validateStep = () => {
    if (step === 0) {
      if (!formData.email || !formData.password || !formData.confirm_password) {
        setError('Email and password fields are required.');
        return false;
      }
      if (formData.password !== formData.confirm_password) {
        setError('Passwords do not match.');
        return false;
      }
    }

    if (step === 1) {
      if (!formData.restaurant_name || !formData.phone || !formData.address) {
        setError('Restaurant name, phone, and address are required.');
        return false;
      }
      if (formData.latitude == null || formData.longitude == null) {
        setError('Please geocode the address or click on map to place depot pin.');
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        restaurant_name: formData.restaurant_name,
        phone: formData.phone,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      const res = await registerRestaurant(payload);
      localStorage.setItem('odms_token', res.token);
      setToken(res.token);
      setUser(res.user);
      navigate('/kitchen', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 3, md: 6 },
        background:
          'radial-gradient(1200px 700px at 0% 0%, rgba(53,98,255,0.18), transparent 58%), radial-gradient(900px 550px at 100% 0%, rgba(0,171,220,0.14), transparent 55%), linear-gradient(180deg, #061027 0%, #08162F 100%)',
      }}
    >
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: { xs: 3, md: 5 },
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(165deg, rgba(8,18,40,0.95), rgba(7,25,56,0.88))',
              color: '#EBF3FF',
            }}
          >
            <Chip label="RESTAURANT ONBOARDING" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#EBF3FF', fontWeight: 700 }} />
            <Typography variant="h3" sx={{ mt: 2, fontWeight: 800, lineHeight: 1.2 }}>
              Build Your Restaurant Control Center
            </Typography>
            <Typography sx={{ mt: 2, color: 'rgba(235,243,255,0.82)', maxWidth: 540 }}>
              Set up your admin account, define your base location, and prepare your team for production-grade order and delivery operations.
            </Typography>

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.14)' }} />

            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <ShieldCheck size={18} />
                <Typography variant="body2">Secure admin account creation and access control</Typography>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <MapPin size={18} />
                <Typography variant="body2">Precise geocoded depot location for routing optimization</Typography>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Building2 size={18} />
                <Typography variant="body2">Immediate access to kitchen, operations, and analytics modules</Typography>
              </Stack>
            </Stack>

            <Typography sx={{ mt: 4, color: 'rgba(232,240,255,0.68)' }}>
              Need a driver account instead?{' '}
              <Link to="/register/driver" style={{ color: '#8fc6ff', fontWeight: 600 }}>
                Register Driver
              </Link>
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              flex: 1.1,
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              border: '1px solid #D7E2F2',
              background: '#FFFFFF',
            }}
          >
            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.8, color: '#132645' }}>
              Restaurant Registration
            </Typography>
            <Typography sx={{ mb: 3, color: '#5A6C86' }}>
              Create your restaurant admin account and set your delivery depot pin.
            </Typography>

            <Stepper activeStep={step} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

          {step === 0 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField label="Email" type="email" value={formData.email} onChange={updateField('email')} required />
              <TextField label="Password" type="password" value={formData.password} onChange={updateField('password')} required />
              <LinearProgress variant="determinate" value={passwordStrength * 25} />
              <TextField label="Confirm Password" type="password" value={formData.confirm_password} onChange={updateField('confirm_password')} required />
            </Box>
          )}

          {step === 1 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField label="Restaurant Name" value={formData.restaurant_name} onChange={updateField('restaurant_name')} required />
              <TextField label="Phone" value={formData.phone} onChange={updateField('phone')} required />
              <TextField
                label="Address"
                value={addressSearch || formData.address}
                onChange={(e) => setAddressSearch(e.target.value)}
                required
                helperText={geocoding ? 'Resolving address...' : 'Type address to auto-geocode, or click map to pin depot'}
              />
              <Box sx={{ height: 220, borderRadius: 2, overflow: 'hidden', border: '1px solid #ddd' }}>
                <MapContainer
                  center={[formData.latitude || 51.5074, formData.longitude || -0.1278]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapPickHandler
                    onPick={(latlng) => setFormData((prev) => ({
                      ...prev,
                      latitude: Number(latlng.lat.toFixed(6)),
                      longitude: Number(latlng.lng.toFixed(6)),
                    }))}
                  />
                  {formData.latitude != null && formData.longitude != null ? (
                    <Marker position={[formData.latitude, formData.longitude]} icon={pinIcon} draggable={true} eventHandlers={{
                      dragend: (e) => {
                        const pos = e.target.getLatLng();
                        setFormData((prev) => ({
                          ...prev,
                          latitude: Number(pos.lat.toFixed(6)),
                          longitude: Number(pos.lng.toFixed(6)),
                        }));
                      },
                    }} />
                  ) : null}
                </MapContainer>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Selected depot: {formData.latitude ?? '-'}, {formData.longitude ?? '-'}
              </Typography>
            </Box>
          )}

          {step === 2 && (
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography><strong>Email:</strong> {formData.email}</Typography>
              <Typography><strong>Restaurant:</strong> {formData.restaurant_name}</Typography>
              <Typography><strong>Phone:</strong> {formData.phone}</Typography>
              <Typography><strong>Address:</strong> {formData.address}</Typography>
              <Typography><strong>Depot:</strong> {formData.latitude}, {formData.longitude}</Typography>
            </Box>
          )}

            {error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            ) : null}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} disabled={step === 0 || submitting}>Back</Button>
              {step < steps.length - 1 ? (
                <Button variant="contained" onClick={handleNext}>Next</Button>
              ) : (
                <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              )}
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default RestaurantRegistration;
