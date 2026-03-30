import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

function DriverLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: 'Home', icon: <HomeIcon />, path: '/driver/dashboard' },
    { label: 'History', icon: <Inventory2OutlinedIcon />, path: '/driver/history' },
    { label: 'Profile', icon: <PersonOutlineIcon />, path: '/driver/profile' },
  ];

  const active = tabs.find((t) => location.pathname.startsWith(t.path))?.path || '/driver/dashboard';

  return (
    <Box sx={{ pb: '64px', minHeight: '100vh', bgcolor: '#f7f9fc' }}>
      <Outlet />
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={6}>
        <BottomNavigation
          value={active}
          onChange={(_, value) => navigate(value)}
          showLabels
          sx={{ minHeight: 64 }}
        >
          {tabs.map((tab) => (
            <BottomNavigationAction
              key={tab.path}
              label={tab.label}
              value={tab.path}
              icon={tab.icon}
              sx={{ minHeight: 64 }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default DriverLayout;
