import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import api from '../../services/api';
import { formatCurrencyGBP } from '../../utils/currency';

function DriverHistory() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/driver/me/orders').then((res) => setOrders(res.data || [])).catch(() => setOrders([]));
  }, []);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const avg = delivered.length ? Math.round(delivered.reduce((a, o) => a + (o.estimated_delivery_minutes || 0), 0) / delivered.length) : 0;
    return {
      total: delivered.length,
      onTime: delivered.length ? 100 : 0,
      avg,
      rating: 5.0,
    };
  }, [orders]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>Delivery History</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3 }}><CardContent><Typography variant="caption" color="text.secondary">Total</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.total}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3 }}><CardContent><Typography variant="caption" color="text.secondary">On-Time Rate</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.onTime}%</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3 }}><CardContent><Typography variant="caption" color="text.secondary">Avg Time</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.avg} min</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3 }}><CardContent><Typography variant="caption" color="text.secondary">Rating</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.rating}</Typography></CardContent></Card>
        </Grid>
      </Grid>

      <Box>
      {orders.slice(0, 20).map((o) => (
        <Accordion key={o.id} sx={{ borderRadius: '12px !important', mb: 1, overflow: 'hidden' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>#{o.id} · {o.delivery_address}</Typography>
              <Chip size="small" label={(o.status || 'pending').toUpperCase()} color={o.status === 'delivered' ? 'success' : 'primary'} />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>Status: {o.status}</Typography>
            <Typography>Earnings: {formatCurrencyGBP(o.delivery_fee)}</Typography>
            <Typography>Items: {(o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'None'}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
      </Box>
    </Container>
  );
}

export default DriverHistory;
