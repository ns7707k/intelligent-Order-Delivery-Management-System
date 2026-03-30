import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import { getAllRestaurants, applyForAffiliation } from '../../services/api';

function DriverAffiliationApply({ onApplied }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getAllRestaurants();
        setRestaurants(Array.isArray(data) ? data : (data.restaurants || []));
      } catch {
        setError('Failed to load restaurants');
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleApply = async (restaurantId) => {
    setApplying(restaurantId);
    setError(null);
    setSuccess(null);
    try {
      await applyForAffiliation(restaurantId);
      setSuccess('Application sent! Awaiting restaurant approval.');
      if (onApplied) onApplied();
    } catch (err) {
      const msg = err?.response?.data?.error;
      setError(msg || 'Failed to apply.');
    }
    setApplying(null);
  };

  if (loading) return <CircularProgress size={24} sx={{ my: 1 }} />;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Apply to a Restaurant
      </Typography>
      {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
      {success && <Typography color="success.main" sx={{ mb: 1 }}>{success}</Typography>}
      {!restaurants.length && !error && (
        <Typography color="text.secondary">No restaurants registered on the platform yet.</Typography>
      )}
      {restaurants.map((r) => (
        <Card key={r.id} variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <Typography fontWeight={700}>{r.name}</Typography>
            <Typography variant="body2" color="text.secondary">{r.address}</Typography>
            {(r.opens_at || r.closes_at) && (
              <Typography variant="body2" color="text.secondary">
                Hours: {r.opens_at || '?'} – {r.closes_at || '?'}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {r.phone || ''}{r.phone && r.email ? ' | ' : ''}{r.email || ''}
            </Typography>
            <Button
              variant="contained"
              size="small"
              sx={{ mt: 1 }}
              disabled={applying !== null}
              onClick={() => handleApply(r.id)}
            >
              {applying === r.id ? 'Sending...' : 'Apply for Affiliation'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default DriverAffiliationApply;
