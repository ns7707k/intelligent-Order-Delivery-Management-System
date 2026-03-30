import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Menu,
  UtensilsCrossed,
  LayoutDashboard,
  Receipt,
  Truck,
  Route,
  BarChart3,
  Settings,
  Plus,
  Store,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Navigation Component
 * Professional top navigation bar with responsive drawer
 */
const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    return location.pathname.startsWith(path) && path !== '/';
  };

  const mainMenuItems = [
    { path: '/kitchen', label: 'Kitchen', icon: <UtensilsCrossed size={18} /> },
    { path: '/manager', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/orders', label: 'Orders', icon: <Receipt size={18} /> },
    { path: '/drivers', label: 'Drivers', icon: <Truck size={18} /> },
    { path: '/routes', label: 'Routes', icon: <Route size={18} /> },
  ];

  const moreMenuItems = [
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  const quickActions = [
    { path: '/orders/create', label: 'New Order', icon: <Plus size={18} /> },
    { path: '/register', label: 'Register Restaurant', icon: <Store size={18} /> },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    setDrawerOpen(false);
  };

  const drawer = (
    <Box sx={{ width: 280 }} role="presentation">
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: 'white',
      }}>
        <Avatar sx={{ 
          bgcolor: 'secondary.main', 
          width: 40, 
          height: 40,
          fontSize: '1.1rem',
          fontWeight: 700,
        }}>
          <Store size={18} />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
            ODMS
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Order Delivery Management
          </Typography>
        </Box>
      </Box>
      
      <Box sx={{ p: 1 }}>
        <Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block', color: 'text.secondary' }}>
          Main Menu
        </Typography>
        <List disablePadding>
          {[...mainMenuItems, ...moreMenuItems].map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                selected={isActive(item.path)}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  borderLeft: '3px solid transparent',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(59,130,246,0.16)',
                    color: 'white',
                    borderLeftColor: '#3B82F6',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'rgba(59,130,246,0.24)' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: isActive(item.path) ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider sx={{ mx: 2, my: 1 }} />
      
      <Box sx={{ p: 1 }}>
        <Typography variant="overline" sx={{ px: 2, display: 'block', color: 'text.secondary' }}>
          Quick Actions
        </Typography>
        <List disablePadding>
          {quickActions.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton 
                onClick={() => handleNavigate(item.path)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ fontSize: '0.9rem' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<LogOut size={16} />}
          onClick={handleLogout}
          fullWidth
          sx={{ mt: 1.5, mx: 1, width: 'calc(100% - 16px)', borderRadius: 2 }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{
          bgcolor: '#0A0F1E',
          color: '#FFFFFF',
          borderBottom: '1px solid',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 } }}>
          <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 80 } }}>
            {/* Logo */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                cursor: 'pointer',
                mr: 5,
              }}
              onClick={() => navigate('/')}
            >
              <Avatar sx={{ 
                bgcolor: 'rgba(59,130,246,0.2)', 
                width: 48, 
                height: 48,
              }}>
                <Store size={22} />
              </Avatar>
              <Typography
                variant="h5"
                component="div"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                  fontSize: '1.6rem',
                }}
              >
                ODMS
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
                {mainMenuItems.map((item) => (
                  <Button
                    key={item.path}
                    startIcon={item.icon}
                    onClick={() => navigate(item.path)}
                    size="large"
                    sx={{
                      color: '#FFFFFF',
                      fontWeight: isActive(item.path) ? 700 : 500,
                      bgcolor: 'transparent',
                      borderRadius: 1,
                      px: 2,
                      py: 1.25,
                      fontSize: '1rem',
                      borderLeft: isActive(item.path) ? '3px solid #3B82F6' : '3px solid transparent',
                      '& .MuiButton-startIcon': { mr: 1 },
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.06)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            )}

            {/* Spacer for mobile */}
            {isMobile && <Box sx={{ flexGrow: 1 }} />}

            {/* Right side actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!isMobile && (
                <Chip
                  label="v1.0"
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', height: 28, borderColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }}
                />
              )}
              {!isMobile && (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<LogOut size={16} />}
                  onClick={handleLogout}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.25)',
                    color: '#FFFFFF',
                    minWidth: 110,
                    '&:hover': {
                      borderColor: '#FFFFFF',
                      bgcolor: 'rgba(255,255,255,0.08)',
                    },
                  }}
                >
                  Logout
                </Button>
              )}
              <IconButton
                onClick={() => setDrawerOpen(true)}
                size="large"
                sx={{ 
                  border: '1px solid',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  borderRadius: 2,
                  p: 1.25,
                }}
              >
                <Menu size={24} />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { borderRadius: '16px 0 0 16px' } }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Navigation;
