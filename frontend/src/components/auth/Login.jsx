import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { Eye, EyeOff, Store, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { registerPublicDriver, registerRestaurant, resetFirstLoginPassword } from '../../services/api';

const restaurantSteps = ['Account', 'Restaurant', 'Review'];
const driverSteps = ['Profile', 'Vehicle', 'Account'];

function StaticFieldLabel({ children }) {
  return (
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#374151', mb: 0.8 }}>
      {children}
    </Typography>
  );
}

function StyledInput({ hasError = false, ...props }) {
  return (
    <OutlinedInput
      {...props}
      fullWidth
      sx={{
        bgcolor: '#F8FAFC',
        borderRadius: '8px',
        '& .MuiOutlinedInput-input': {
          py: 1.45,
          px: 1.8,
          fontSize: 14,
          color: '#374151',
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: hasError ? '#EF4444' : '#E2E8F0',
          borderWidth: '1px',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: hasError ? '#EF4444' : '#CBD5E1',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: hasError ? '#EF4444' : '#3B82F6',
          borderWidth: '1px',
        },
        '&.Mui-focused': {
          boxShadow: hasError ? '0 0 0 3px #EF444430' : '0 0 0 3px #3B82F615',
        },
      }}
    />
  );
}

function Login() {
  const navigate = useNavigate();
  const { login, setToken, setUser } = useAuth();

  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('restaurant');
  const [tabUnderlineLeft, setTabUnderlineLeft] = useState(0);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shakeNonce, setShakeNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [restaurantStep, setRestaurantStep] = useState(0);
  const [driverStep, setDriverStep] = useState(0);

  const [restaurantForm, setRestaurantForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    restaurant_name: '',
    phone: '',
    address: '',
  });
  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    vehicle_type: 'Motorcycle',
    vehicle_number: '',
    license_number: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const registerSteps = accountType === 'restaurant' ? restaurantSteps : driverSteps;
  const registerStep = accountType === 'restaurant' ? restaurantStep : driverStep;

  const setModeAndUnderline = (nextMode) => {
    setMode(nextMode);
    setTabUnderlineLeft(nextMode === 'login' ? 0 : 50);
    setError('');
  };

  const triggerShake = () => {
    setShakeNonce((prev) => prev + 1);
  };

  const passwordStrength = useMemo(() => {
    const value = mode === 'login'
      ? loginPassword
      : accountType === 'restaurant'
        ? restaurantForm.password
        : driverForm.password;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }, [accountType, driverForm.password, loginPassword, mode, restaurantForm.password]);

  const updateRestaurantField = (field, value) => {
    setRestaurantForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDriverField = (field, value) => {
    setDriverForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateRegisterStep = () => {
    if (accountType === 'restaurant') {
      if (restaurantStep === 0) {
        if (!restaurantForm.email || !restaurantForm.password || !restaurantForm.confirmPassword) {
          setError('Email and password fields are required.');
          triggerShake();
          return false;
        }
        if (restaurantForm.password !== restaurantForm.confirmPassword) {
          setError('Passwords do not match.');
          triggerShake();
          return false;
        }
      }
      if (restaurantStep === 1) {
        if (!restaurantForm.restaurant_name || !restaurantForm.phone || !restaurantForm.address) {
          setError('Restaurant name, phone, and address are required.');
          triggerShake();
          return false;
        }
      }
      return true;
    }

    if (driverStep === 0) {
      if (!driverForm.name || !driverForm.phone) {
        setError('Driver name and phone are required.');
        triggerShake();
        return false;
      }
    }
    if (driverStep === 1) {
      if (!driverForm.vehicle_type) {
        setError('Vehicle type is required.');
        triggerShake();
        return false;
      }
    }
    if (driverStep === 2) {
      if (!driverForm.email || !driverForm.password || !driverForm.confirmPassword) {
        setError('Email and password fields are required.');
        triggerShake();
        return false;
      }
      if (driverForm.password !== driverForm.confirmPassword) {
        setError('Passwords do not match.');
        triggerShake();
        return false;
      }
    }
    return true;
  };

  const handleRegisterNext = () => {
    setError('');
    if (!validateRegisterStep()) return;

    if (accountType === 'restaurant') {
      setRestaurantStep((prev) => Math.min(prev + 1, 2));
    } else {
      setDriverStep((prev) => Math.min(prev + 1, 2));
    }
  };

  const handleRegisterBack = () => {
    setError('');
    if (accountType === 'restaurant') {
      setRestaurantStep((prev) => Math.max(prev - 1, 0));
    } else {
      setDriverStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleRegisterSubmit = async () => {
    setError('');
    if (!validateRegisterStep()) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      if (accountType === 'restaurant') {
        const res = await registerRestaurant({
          email: restaurantForm.email,
          password: restaurantForm.password,
          restaurant_name: restaurantForm.restaurant_name,
          phone: restaurantForm.phone,
          address: restaurantForm.address,
        });
        localStorage.setItem('odms_token', res.token);
        setToken(res.token);
        setUser(res.user);
        navigate('/kitchen', { replace: true });
      } else {
        const res = await registerPublicDriver({
          name: driverForm.name,
          phone: driverForm.phone,
          email: driverForm.email,
          vehicle_type: driverForm.vehicle_type,
          vehicle_number: driverForm.vehicle_number,
          license_number: driverForm.license_number,
          password: driverForm.password,
        });
        localStorage.setItem('odms_token', res.token);
        setToken(res.token);
        setUser(res.user);
        navigate('/driver/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const result = await login(loginEmail, loginPassword);

      if (result?.reset_required) {
        setPasswordResetRequired(true);
        setResetEmail(loginEmail);
        setTempPassword(loginPassword);
        setError(result?.message || 'Please reset your password to continue.');
        return;
      }

      const user = result?.user;
      if (accountType === 'driver' && user?.role !== 'driver') {
        setError('This account is not a driver account. Choose Restaurant sign in.');
        triggerShake();
        return;
      }
      if (accountType === 'restaurant' && user?.role !== 'restaurant_admin') {
        setError('This account is not a restaurant account. Choose Driver sign in.');
        triggerShake();
        return;
      }
      if (user?.role === 'driver') {
        navigate('/driver/dashboard', { replace: true });
      } else {
        navigate('/kitchen', { replace: true });
      }
    } catch (err) {
      if (!err?.response) {
        setError('Unable to reach server. Please ensure backend is running and refresh the page.');
      } else {
        setError(err?.response?.data?.error || 'Invalid email or password');
      }
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const handleFirstLoginPasswordReset = async () => {
    setError('');
    if (!newPassword || !confirmNewPassword) {
      setError('Please provide and confirm your new password.');
      triggerShake();
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      triggerShake();
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetFirstLoginPassword({
        email: resetEmail,
        current_password: tempPassword,
        new_password: newPassword,
      });

      localStorage.setItem('odms_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setPasswordResetRequired(false);
      navigate('/driver/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to reset password.');
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const renderRegisterStepContent = () => {
    if (accountType === 'restaurant') {
      if (restaurantStep === 0) {
        return (
          <Stack spacing={1.6}>
            <Box>
              <StaticFieldLabel>Email</StaticFieldLabel>
              <StyledInput value={restaurantForm.email} onChange={(e) => updateRestaurantField('email', e.target.value)} placeholder="name@restaurant.com" />
            </Box>
            <Box>
              <StaticFieldLabel>Password</StaticFieldLabel>
              <StyledInput
                type={showPassword ? 'text' : 'password'}
                value={restaurantForm.password}
                onChange={(e) => updateRestaurantField('password', e.target.value)}
                placeholder="Create a strong password"
                endAdornment={(
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                )}
              />
            </Box>
            <Box>
              <StaticFieldLabel>Confirm Password</StaticFieldLabel>
              <StyledInput type={showPassword ? 'text' : 'password'} value={restaurantForm.confirmPassword} onChange={(e) => updateRestaurantField('confirmPassword', e.target.value)} placeholder="Repeat password" />
            </Box>
          </Stack>
        );
      }

      if (restaurantStep === 1) {
        return (
          <Stack spacing={1.6}>
            <Box>
              <StaticFieldLabel>Restaurant Name</StaticFieldLabel>
              <StyledInput value={restaurantForm.restaurant_name} onChange={(e) => updateRestaurantField('restaurant_name', e.target.value)} placeholder="Your restaurant brand" />
            </Box>
            <Box>
              <StaticFieldLabel>Phone</StaticFieldLabel>
              <StyledInput value={restaurantForm.phone} onChange={(e) => updateRestaurantField('phone', e.target.value)} placeholder="+44 ..." />
            </Box>
            <Box>
              <StaticFieldLabel>Address</StaticFieldLabel>
              <StyledInput value={restaurantForm.address} onChange={(e) => updateRestaurantField('address', e.target.value)} placeholder="Delivery dispatch address" />
            </Box>
          </Stack>
        );
      }

      return (
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 14, color: '#374151' }}><strong>Email:</strong> {restaurantForm.email}</Typography>
          <Typography sx={{ fontSize: 14, color: '#374151' }}><strong>Restaurant:</strong> {restaurantForm.restaurant_name}</Typography>
          <Typography sx={{ fontSize: 14, color: '#374151' }}><strong>Phone:</strong> {restaurantForm.phone}</Typography>
          <Typography sx={{ fontSize: 14, color: '#374151' }}><strong>Address:</strong> {restaurantForm.address}</Typography>
        </Stack>
      );
    }

    if (driverStep === 0) {
      return (
        <Stack spacing={1.6}>
          <Box>
            <StaticFieldLabel>Driver Name</StaticFieldLabel>
            <StyledInput value={driverForm.name} onChange={(e) => updateDriverField('name', e.target.value)} placeholder="Full name" />
          </Box>
          <Box>
            <StaticFieldLabel>Phone</StaticFieldLabel>
            <StyledInput value={driverForm.phone} onChange={(e) => updateDriverField('phone', e.target.value)} placeholder="+44 ..." />
          </Box>
        </Stack>
      );
    }

    if (driverStep === 1) {
      return (
        <Stack spacing={1.6}>
          <Box>
            <StaticFieldLabel>Vehicle Type</StaticFieldLabel>
            <StyledInput value={driverForm.vehicle_type} onChange={(e) => updateDriverField('vehicle_type', e.target.value)} placeholder="Motorcycle / Car / Bike" />
          </Box>
          <Box>
            <StaticFieldLabel>Vehicle Number (Optional)</StaticFieldLabel>
            <StyledInput value={driverForm.vehicle_number} onChange={(e) => updateDriverField('vehicle_number', e.target.value)} placeholder="AB12 CDE" />
          </Box>
          <Box>
            <StaticFieldLabel>License Number (Optional)</StaticFieldLabel>
            <StyledInput value={driverForm.license_number} onChange={(e) => updateDriverField('license_number', e.target.value)} placeholder="DL123456" />
          </Box>
        </Stack>
      );
    }

    return (
      <Stack spacing={1.6}>
        <Box>
          <StaticFieldLabel>Email</StaticFieldLabel>
          <StyledInput value={driverForm.email} onChange={(e) => updateDriverField('email', e.target.value)} placeholder="name@driver.com" />
        </Box>
        <Box>
          <StaticFieldLabel>Password</StaticFieldLabel>
          <StyledInput
            type={showPassword ? 'text' : 'password'}
            value={driverForm.password}
            onChange={(e) => updateDriverField('password', e.target.value)}
            placeholder="Create a strong password"
            endAdornment={(
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </IconButton>
              </InputAdornment>
            )}
          />
        </Box>
        <Box>
          <StaticFieldLabel>Confirm Password</StaticFieldLabel>
          <StyledInput type={showPassword ? 'text' : 'password'} value={driverForm.confirmPassword} onChange={(e) => updateDriverField('confirmPassword', e.target.value)} placeholder="Repeat password" />
        </Box>
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        fontFamily: '"Manrope", "IBM Plex Sans", "Segoe UI", sans-serif',
        minHeight: '100vh',
        py: { xs: 0, md: 0 },
        background:
          'radial-gradient(1300px 700px at 12% 18%, #25385F 0%, transparent 62%), radial-gradient(1100px 650px at 88% 78%, #101B35 0%, transparent 56%), linear-gradient(160deg, #070B16 0%, #0B1327 100%)',
        display: 'flex',
        overflow: 'hidden',
        '@keyframes pulseLive': {
          '0%': { opacity: 0.6, transform: 'scale(1)' },
          '100%': { opacity: 1, transform: 'scale(1.12)' },
        },
        '@keyframes dashDraw': {
          '0%': { strokeDashoffset: 140 },
          '100%': { strokeDashoffset: 0 },
        },
        '@keyframes tabSlide': {
          '0%': { opacity: 0.7 },
          '100%': { opacity: 1 },
        },
        '@keyframes shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
      }}
    >
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          px: 0,
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={0}
          alignItems="stretch"
          sx={{ width: '100%', minHeight: '100vh' }}
        >
          <Paper
            elevation={0}
            sx={{
              display: { xs: 'none', md: 'flex' },
              flex: '1 1 60%',
              px: { md: 7, lg: 9 },
              py: { md: 5, lg: 6 },
              borderRadius: 0,
              border: 0,
              background:
                'linear-gradient(165deg, #040812 0%, #0A1430 56%, #11224A 100%)',
              color: '#EBF3FF',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, #60A5FA2B 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                opacity: 0.12,
                pointerEvents: 'none',
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <circle cx="6" cy="24" r="3" fill="white" />
                    <circle cx="16" cy="14" r="3" fill="white" />
                    <circle cx="26" cy="8" r="3" fill="white" />
                    <path d="M8 22L14 16M18.5 12L23.5 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1 }}>
                    ODMS
                  </Typography>
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.6 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#10B981',
                        animation: 'pulseLive 1200ms ease-in-out infinite alternate',
                      }}
                    />
                    <Typography sx={{ fontSize: 11, letterSpacing: '0.24em', fontWeight: 400, color: '#B9C8E6' }}>
                      ENTERPRISE
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box sx={{ position: 'relative', zIndex: 1, mt: 2 }}>
              <svg width="100%" height="280" viewBox="0 0 560 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <rect x="40" y="120" width="120" height="95" rx="10" fill="#132341" stroke="#3B82F6" strokeWidth="2" />
                <rect x="58" y="88" width="84" height="36" rx="8" fill="#1C335E" stroke="#3B82F6" strokeWidth="2" />
                <rect x="88" y="158" width="24" height="57" rx="4" fill="#0F1D34" stroke="#10B981" strokeWidth="2" />
                <circle cx="100" cy="186" r="3" fill="#10B981" />

                <path
                  d="M170 172C245 152 268 112 350 112C404 112 435 130 490 162"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="7 7"
                  strokeDashoffset="140"
                  style={{ animation: 'dashDraw 2s linear infinite' }}
                  fill="none"
                />

                <circle cx="232" cy="142" r="7" fill="#3B82F6" />
                <circle cx="322" cy="116" r="7" fill="#10B981" />
                <circle cx="412" cy="124" r="7" fill="#F59E0B" />

                <path d="M490 150C475 150 463 162 463 177C463 198 490 226 490 226C490 226 517 198 517 177C517 162 505 150 490 150Z" fill="#F59E0B" />
                <circle cx="490" cy="177" r="8" fill="#0A0F1E" />
              </svg>

                <Typography sx={{ mt: 1.5, fontSize: 30, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                Unified Delivery Operations Platform
              </Typography>
              <Typography sx={{ mt: 1.5, fontSize: 15, color: '#94A3B8', maxWidth: 420 }}>
                Designed for restaurants that demand operational excellence.
              </Typography>

              <Box sx={{ borderBottom: '1px solid #ffffff15', my: 2.3, width: 360, maxWidth: '100%' }} />

              <Stack spacing={1.2}>
                <Typography sx={{ fontSize: 14, color: '#FFFFFF' }}><span style={{ color: '#3B82F6', marginRight: 8 }}>⬡</span>Voice-activated kitchen workflows</Typography>
                <Typography sx={{ fontSize: 14, color: '#FFFFFF' }}><span style={{ color: '#3B82F6', marginRight: 8 }}>⬡</span>Intelligent route optimization</Typography>
                <Typography sx={{ fontSize: 14, color: '#FFFFFF' }}><span style={{ color: '#3B82F6', marginRight: 8 }}>⬡</span>Real-time fleet visibility</Typography>
              </Stack>
            </Box>

            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                bgcolor: '#111827',
                borderRadius: 2,
                px: 2,
                py: 1,
                mt: 2.5,
              }}
            >
              <Typography sx={{ textAlign: 'center', fontSize: 11, color: '#64748B' }}>
                Trusted by restaurant operators · Powered by OR-Tools VRP · OpenStreetMap
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              flex: { xs: '1 1 100%', md: '1 1 40%' },
              p: { xs: 2.5, sm: 3.5, md: 5 },
              borderRadius: 0,
              border: 0,
              background: '#FFFFFF',
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow: { md: '-8px 0 32px rgba(0,0,0,0.15)' },
              animation: error ? 'shake 260ms ease-in-out' : 'none',
              animationDelay: `${shakeNonce * 1}ms`,
            }}
          >
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.2, mb: 2.5 }}>
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle cx="6" cy="24" r="3" fill="#0A0F1E" />
                <circle cx="16" cy="14" r="3" fill="#0A0F1E" />
                <circle cx="26" cy="8" r="3" fill="#0A0F1E" />
                <path d="M8 22L14 16M18.5 12L23.5 9" stroke="#0A0F1E" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#0A0F1E' }}>
                ODMS
              </Typography>
            </Box>

            <Box sx={{ position: 'relative', mb: 2.2, pb: 1.2, borderBottom: '1px solid #E2E8F0' }}>
              <Stack direction="row" sx={{ position: 'relative' }}>
                <Button
                  variant="text"
                  disableRipple
                  onClick={() => setModeAndUnderline('login')}
                  sx={{
                    flex: 1,
                    justifyContent: 'center',
                    color: mode === 'login' ? '#0A0F1E' : '#94A3B8',
                    fontWeight: mode === 'login' ? 700 : 500,
                    fontSize: 15,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="text"
                  disableRipple
                  onClick={() => setModeAndUnderline('register')}
                  sx={{
                    flex: 1,
                    justifyContent: 'center',
                    color: mode === 'register' ? '#0A0F1E' : '#94A3B8',
                    fontWeight: mode === 'register' ? 700 : 500,
                    fontSize: 15,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  Register
                </Button>
              </Stack>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -1,
                  left: `${tabUnderlineLeft}%`,
                  width: '50%',
                  height: 2,
                  bgcolor: '#3B82F6',
                  transition: 'left 200ms ease',
                  animation: 'tabSlide 200ms ease',
                }}
              />
            </Box>

            <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#0A0F1E', mb: 0.8 }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 400, color: '#64748B', mb: 2.5 }}>
              {mode === 'login'
                ? 'Sign in to your ODMS workspace.'
                : accountType === 'restaurant'
                  ? `Step ${restaurantStep + 1} of 3`
                  : `Step ${driverStep + 1} of 3`}
            </Typography>

            {mode === 'register' ? (
              <Stepper activeStep={registerStep} alternativeLabel sx={{ mb: 2.5 }}>
                {registerSteps.map((label) => (
                  <Step key={label}>
                    <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 11 } }}>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            ) : null}

            <Stack direction="row" spacing={1.4} sx={{ mb: 2.5 }}>
              <Button
                onClick={() => {
                  setAccountType('restaurant');
                  setError('');
                }}
                disableRipple
                sx={{
                  width: 120,
                  height: 80,
                  borderRadius: 2,
                  border: accountType === 'restaurant' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                  bgcolor: accountType === 'restaurant' ? '#FFFFFF' : '#F8FAFC',
                  boxShadow: accountType === 'restaurant' ? '0 0 0 3px #3B82F620' : 'none',
                  transition: 'all 150ms ease',
                  color: accountType === 'restaurant' ? '#3B82F6' : '#94A3B8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  textTransform: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <Store size={19} />
                Restaurant
              </Button>
              <Button
                onClick={() => {
                  setAccountType('driver');
                  setError('');
                }}
                disableRipple
                sx={{
                  width: 120,
                  height: 80,
                  borderRadius: 2,
                  border: accountType === 'driver' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                  bgcolor: accountType === 'driver' ? '#FFFFFF' : '#F8FAFC',
                  boxShadow: accountType === 'driver' ? '0 0 0 3px #3B82F620' : 'none',
                  transition: 'all 150ms ease',
                  color: accountType === 'driver' ? '#3B82F6' : '#94A3B8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  textTransform: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <Truck size={19} />
                Driver
              </Button>
            </Stack>

            {mode === 'login' ? (
              <form onSubmit={handleSubmit}>
                <Stack spacing={1.6}>
                  {passwordResetRequired ? (
                    <>
                      <Alert severity="info">
                        First login detected. Set a new password to continue.
                      </Alert>
                      <Box>
                        <StaticFieldLabel>New Password</StaticFieldLabel>
                        <StyledInput
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          hasError={Boolean(error)}
                          endAdornment={(
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </IconButton>
                            </InputAdornment>
                          )}
                        />
                      </Box>
                      <Box>
                        <StaticFieldLabel>Confirm New Password</StaticFieldLabel>
                        <StyledInput
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          hasError={Boolean(error)}
                        />
                      </Box>
                    </>
                  ) : (
                    <>
                  <Box>
                    <StaticFieldLabel>Email</StaticFieldLabel>
                    <StyledInput
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      type="email"
                      placeholder="name@company.com"
                      hasError={Boolean(error)}
                    />
                  </Box>
                  <Box>
                    <StaticFieldLabel>Password</StaticFieldLabel>
                    <StyledInput
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      hasError={Boolean(error)}
                      endAdornment={(
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      )}
                    />
                  </Box>
                    </>
                  )}
                </Stack>

                {error ? (
                  <Typography sx={{ mt: 1.1, mb: 1.4, fontSize: 12, color: '#EF4444' }}>
                    {error}
                  </Typography>
                ) : null}

                <Box sx={{ textAlign: 'right', mb: 1.2 }}>
                  <Button
                    variant="text"
                    disableRipple
                    sx={{
                      minWidth: 0,
                      p: 0,
                      fontSize: 13,
                      color: '#3B82F6',
                      textTransform: 'none',
                      '&:hover': { textDecoration: 'underline', bgcolor: 'transparent' },
                    }}
                  >
                    Forgot password?
                  </Button>
                </Box>
                <Button
                  type={passwordResetRequired ? 'button' : 'submit'}
                  onClick={passwordResetRequired ? handleFirstLoginPasswordReset : undefined}
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: 0.2,
                    minHeight: 50,
                    borderRadius: '8px',
                    bgcolor: '#3B82F6',
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: 0,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#2563EB' },
                    '&:active': { transform: 'scale(0.98)' },
                  }}
                >
                  {submitting
                    ? <CircularProgress size={18} sx={{ color: 'white' }} />
                    : passwordResetRequired
                      ? 'Set New Password'
                      : accountType === 'driver' ? 'Sign In as Driver' : 'Sign In as Restaurant'}
                </Button>

                <Typography sx={{ mt: 1.8, textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                  New account? Use the Register tab above.
                </Typography>
              </form>
            ) : (
              <Box sx={{ transition: 'transform 220ms ease, opacity 220ms ease', transform: 'translateX(0)', opacity: 1 }}>
                {renderRegisterStepContent()}

                {error ? <Alert severity="error" sx={{ mt: 1.2 }}>{error}</Alert> : null}

                <Typography sx={{ mt: 1.5, fontSize: 12, color: '#64748B' }}>
                  Password strength: {passwordStrength}/4
                </Typography>

                <Stack direction="row" spacing={1.2} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleRegisterBack}
                    disabled={registerStep === 0 || submitting}
                    sx={{ flex: 1, borderRadius: '8px', textTransform: 'none' }}
                  >
                    Back
                  </Button>
                  {registerStep < 2 ? (
                    <Button
                      variant="contained"
                      onClick={handleRegisterNext}
                      sx={{
                        flex: 1,
                        borderRadius: '8px',
                        textTransform: 'none',
                        bgcolor: '#3B82F6',
                        '&:hover': { bgcolor: '#2563EB' },
                      }}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleRegisterSubmit}
                      sx={{
                        flex: 1,
                        borderRadius: '8px',
                        textTransform: 'none',
                        bgcolor: '#3B82F6',
                        '&:hover': { bgcolor: '#2563EB' },
                      }}
                    >
                      {submitting ? <CircularProgress size={18} sx={{ color: 'white' }} /> : accountType === 'driver' ? 'Register as Platform Driver' : 'Register Restaurant'}
                    </Button>
                  )}
                </Stack>
              </Box>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

export default Login;
