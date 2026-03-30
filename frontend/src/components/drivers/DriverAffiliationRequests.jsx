import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Chip, Typography } from '@mui/material';
import { getAffiliationRequests, approveAffiliationRequest, rejectAffiliationRequest } from '../../services/api';

function DriverAffiliationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioning, setActioning] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAffiliationRequests();
      setRequests(Array.isArray(data) ? data : (data.requests || []));
    } catch {
      setError('Failed to load affiliation requests');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (requestId, action) => {
    setActioning(requestId + action);
    try {
      if (action === 'approve') {
        await approveAffiliationRequest(requestId);
      } else {
        await rejectAffiliationRequest(requestId);
      }
      await load();
    } catch {
      setError('Failed to update request');
    }
    setActioning(null);
  };

  if (loading) return <CircularProgress size={24} sx={{ my: 1 }} />;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Driver Affiliation Requests
        {requests.length > 0 && (
          <Chip
            label={requests.length}
            size="small"
            color="warning"
            sx={{ ml: 1, fontWeight: 700 }}
          />
        )}
      </Typography>
      {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
      {!requests.length && !error && (
        <Typography variant="body2" color="text.secondary">No pending requests.</Typography>
      )}
      {requests.map((req) => (
        <Card key={req.id} variant="outlined" sx={{ mb: 1.5, borderRadius: 2 }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <Typography fontWeight={700}>{req.driver_name || req.driver_id}</Typography>
            {req.driver_email && (
              <Typography variant="body2" color="text.secondary">{req.driver_email}</Typography>
            )}
            {req.driver_phone && (
              <Typography variant="body2" color="text.secondary">Phone: {req.driver_phone}</Typography>
            )}
            {req.driver_vehicle && (
              <Typography variant="body2" color="text.secondary">Vehicle: {req.driver_vehicle}</Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Applied: {new Date(req.created_at).toLocaleString()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={!!actioning}
                onClick={() => handleAction(req.id, 'approve')}
              >
                {actioning === req.id + 'approve' ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={!!actioning}
                onClick={() => handleAction(req.id, 'reject')}
              >
                {actioning === req.id + 'reject' ? 'Rejecting...' : 'Reject'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default DriverAffiliationRequests;
