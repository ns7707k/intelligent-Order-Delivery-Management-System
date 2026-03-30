import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Building2, ShieldCheck, Truck } from 'lucide-react';
import { registerPublicDriver } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const vehicleTypes = ['Motorcycle', 'Car', 'Bike', 'Scooter', 'Van'];

function DriverRegistration() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle_type: 'Motorcycle',
    vehicle_number: '',
    license_number: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 8) score += 1;
    if (/[A-Z]/.test(form.password)) score += 1;
    if (/\d/.test(form.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(form.password)) score += 1;
    return score;
  }, [form.password]);

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.phone || !form.password || !form.confirm_password) {
      setError('Please complete all required fields.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerPublicDriver({
        name: form.name,
        email: form.email,
        phone: form.phone,
        vehicle_type: form.vehicle_type,
        vehicle_number: form.vehicle_number,
        license_number: form.license_number,
        password: form.password,
      });

      localStorage.setItem('odms_token', res.token);
      setToken(res.token);
      setUser(res.user);
      navigate('/driver/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Driver registration failed. Please try again.');
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
          'radial-gradient(1200px 600px at 10% 10%, rgba(43,96,255,0.16), transparent 55%), radial-gradient(900px 500px at 100% 0%, rgba(0,153,255,0.12), transparent 52%), linear-gradient(180deg, #081126 0%, #0A1632 100%)',
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
              background: 'linear-gradient(160deg, rgba(7,16,36,0.92), rgba(10,24,52,0.88))',
              color: '#E8F0FF',
            }}
          >
            <Typography sx={{ fontSize: 12, letterSpacing: 1.6, opacity: 0.8 }}>ODMS FLEET NETWORK</Typography>
            <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 800, lineHeight: 1.2 }}>
              Register As Driver
            </Typography>
            <Typography sx={{ mt: 2, color: 'rgba(232,240,255,0.82)' }}>
              Join the delivery network with a verified driver account and access your mobile-ready dashboard instantly.
            </Typography>

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.14)' }} />

            <Stack spacing={1.8}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <ShieldCheck size={18} />
                <Typography variant="body2">Secure credential flow and role-based access control</Typography>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Truck size={18} />
                <Typography variant="body2">Live assignment and route visibility on login</Typography>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Building2 size={18} />
                <Typography variant="body2">Works across platform and restaurant-managed fleets</Typography>
              </Stack>
            </Stack>

            <Typography sx={{ mt: 4, color: 'rgba(232,240,255,0.68)' }}>
              Need a restaurant account instead?{' '}
              <Link to="/register/restaurant" style={{ color: '#8fc6ff', fontWeight: 600 }}>
                Register Restaurant
              </Link>
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              flex: 1.05,
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              border: '1px solid #D8E3F4',
              background: '#FFFFFF',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#132645' }}>
              Create Driver Account
            </Typography>
            <Typography sx={{ mt: 0.8, color: '#5A6C86' }}>
              Use business contact details for assignment notifications.
            </Typography>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
              <Stack spacing={2}>
                <TextField label="Full Name" value={form.name} onChange={update('name')} required />
                <TextField label="Work Email" type="email" value={form.email} onChange={update('email')} required />
                <TextField label="Phone" value={form.phone} onChange={update('phone')} required />
                <TextField select label="Vehicle Type" value={form.vehicle_type} onChange={update('vehicle_type')}>
                  {vehicleTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Vehicle Number" value={form.vehicle_number} onChange={update('vehicle_number')} />
                <TextField label="License Number" value={form.license_number} onChange={update('license_number')} />
                <TextField label="Password" type="password" value={form.password} onChange={update('password')} required />
                <LinearProgress variant="determinate" value={passwordStrength * 25} />
                <TextField
                  label="Confirm Password"
                  type="password"
                  value={form.confirm_password}
                  onChange={update('confirm_password')}
                  required
                />

                {error ? <Alert severity="error">{error}</Alert> : null}

                <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ minHeight: 48 }}>
                  {submitting ? 'Creating Account...' : 'Register Driver'}
                </Button>

                <Typography variant="body2" sx={{ color: '#61738E', textAlign: 'center' }}>
                  Already have an account?{' '}
                  <Link to="/login" style={{ fontWeight: 700, color: '#1E5FC6' }}>
                    Sign in
                  </Link>
                </Typography>
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default DriverRegistration;
