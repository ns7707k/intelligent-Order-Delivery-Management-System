import { Box, Button, Card, CardContent, Chip, Container, Grid, Switch, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useEffect, useState } from 'react';

function DriverProfile() {
  const { user, logout } = useAuth();
  const [driver, setDriver] = useState(null);

  const load = async () => {
    const res = await api.get('/driver/me');
    setDriver(res.data?.driver);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async () => {
    const next = driver?.status === 'offline' ? 'available' : 'offline';
    await api.patch('/driver/me/status', { status: next });
    await load();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>Driver Profile</Typography>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h5" fontWeight={700}>{driver?.name || user?.email}</Typography>
              <Typography color="text.secondary">Driver ID: {driver?.id || user?.driver_id}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Chip label={(driver?.status || 'offline').toUpperCase()} color={driver?.status === 'offline' ? 'default' : 'success'} />
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Typography><strong>Email:</strong> {driver?.email || user?.email || '-'}</Typography>
            <Typography><strong>Vehicle:</strong> {driver?.vehicle_type || '-'}</Typography>
            <Typography><strong>Total deliveries:</strong> {driver?.total_deliveries || 0}</Typography>
            <Typography><strong>Rating:</strong> {driver?.rating || 5}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
            <Switch checked={driver?.status !== 'offline'} onChange={toggle} />
            <Typography>{driver?.status === 'offline' ? 'Offline' : 'Available'}</Typography>
          </Box>

          <Button variant="outlined" color="error" onClick={logout} sx={{ mt: 1 }}>Logout</Button>
        </CardContent>
      </Card>
    </Container>
  );
}

export default DriverProfile;
