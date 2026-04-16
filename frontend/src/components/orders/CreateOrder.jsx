import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  IconButton,
  Divider,
  MenuItem,
  Alert,
} from '@mui/material';
import { ArrowLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createOrder, geocodeAddress } from '../../services/api';

const pinIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#1976d2;border:2px solid #fff;box-shadow:0 0 0 2px #1976d2"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const buildAddressCandidates = (address) => {
  const normalized = (address || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  const candidates = [normalized];
  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 3) {
    const withoutShortContext = parts.filter((part, idx) => {
      if (idx === 0 || idx === parts.length - 1) return true;
      return /\d/.test(part) || part.split(/\s+/).length > 3;
    }).join(', ');

    if (withoutShortContext && withoutShortContext !== normalized) {
      candidates.push(withoutShortContext);
    }

    candidates.push([parts[0], parts[parts.length - 2], parts[parts.length - 1]].join(', '));
    candidates.push([parts[0], parts[parts.length - 2]].join(', '));
  }

  const postcodeMatch = normalized.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  if (postcodeMatch) {
    candidates.push(`${postcodeMatch[1]}, United Kingdom`);
  }

  return [...new Set(candidates.filter(Boolean))];
};

const CreateOrder = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    delivery_address: '',
    latitude: null,
    longitude: null,
    notes: '',
    payment_method: 'Card',
  });
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingResult, setGeocodingResult] = useState(null);
  const [geocodingError, setGeocodingError] = useState(null);
  const [confirmedGeo, setConfirmedGeo] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, price: 0 }]);
  const removeItem = (index) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!formData.delivery_address.trim() || confirmedGeo) return;
      setGeocodingLoading(true);
      setGeocodingError(null);
      try {
        const candidates = buildAddressCandidates(formData.delivery_address);
        let resolvedGeo = null;

        for (const candidate of candidates) {
          try {
            const geo = await geocodeAddress(candidate);
            if (geo?.lat != null && geo?.lng != null) {
              resolvedGeo = geo;
              break;
            }
          } catch {
            // Try next candidate variant
          }
        }

        if (!resolvedGeo) {
          setGeocodingResult(null);
          setGeocodingError('Address not found — please check and try again.');
        } else {
          setGeocodingResult(resolvedGeo);
        }
      } catch {
        setGeocodingResult(null);
        setGeocodingError('Address not found — please check and try again.');
      } finally {
        setGeocodingLoading(false);
      }
    }, 600);

    return () => clearTimeout(t);
  }, [formData.delivery_address, confirmedGeo]);

  const confirmAddress = () => {
    if (!geocodingResult) return;
    setConfirmedGeo(geocodingResult);
    setFormData((prev) => ({
      ...prev,
      delivery_address: geocodingResult.display_address || prev.delivery_address,
      latitude: geocodingResult.lat,
      longitude: geocodingResult.lng,
    }));
  };

  const clearAddressConfirmation = () => {
    setConfirmedGeo(null);
    setFormData((prev) => ({ ...prev, latitude: null, longitude: null }));
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08;
    const deliveryFee = confirmedGeo?.delivery_fee || geocodingResult?.delivery_fee || 4.99;
    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      total: (subtotal + tax + deliveryFee).toFixed(2),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmedGeo || formData.latitude == null || formData.longitude == null) {
      setError('Please confirm a valid delivery address before placing the order.');
      return;
    }

    try {
      const totals = calculateTotal();
      const orderData = {
        ...formData,
        items,
        delivery_fee: Number(totals.deliveryFee),
        subtotal: Number(totals.subtotal),
        tax: Number(totals.tax),
        total: Number(totals.total),
      };
      await createOrder(orderData);
      setSuccess(true);
      setTimeout(() => navigate('/orders'), 1500);
    } catch {
      setError('Failed to create order. Please try again.');
    }
  };

  const totals = calculateTotal();

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)}><ArrowLeft size={20} /></IconButton>
          <Typography variant="h4" fontWeight="bold">Create New Order</Typography>
        </Box>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {success ? <Alert severity="success" sx={{ mb: 2 }}>Order created successfully!</Alert> : null}

        <form onSubmit={handleSubmit}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">Customer Information</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth required label="Customer Name" name="customer_name" value={formData.customer_name} onChange={handleInputChange} /></Grid>
              <Grid item xs={12}><TextField fullWidth required label="Phone" name="customer_phone" value={formData.customer_phone} onChange={handleInputChange} /></Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={2}
                  label="Delivery Address"
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleInputChange}
                  disabled={Boolean(confirmedGeo)}
                  helperText={geocodingLoading ? 'Resolving address...' : confirmedGeo ? 'Address confirmed' : 'Type address to geocode'}
                />

                {geocodingResult && !confirmedGeo ? (
                  <Paper sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', border: '2px solid #2196f3', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <MapPin size={18} />
                      <Typography variant="body2" fontWeight="bold">{geocodingResult.display_address}</Typography>
                    </Box>
                    <Typography variant="body2">Distance: {geocodingResult.distance_km ?? '-'} km</Typography>
                    <Typography variant="body2">Estimated time: ~{geocodingResult.eta_minutes ?? '-'} min</Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>Delivery fee: £{geocodingResult.delivery_fee ?? 4.99}</Typography>

                    <Box sx={{ height: 200, borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                      <MapContainer
                        center={[geocodingResult.lat, geocodingResult.lng]}
                        zoom={15}
                        dragging={false}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                        boxZoom={false}
                        keyboard={false}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[geocodingResult.lat, geocodingResult.lng]} icon={pinIcon} />
                      </MapContainer>
                    </Box>

                    <Button fullWidth variant="contained" onClick={confirmAddress}>Confirm this address</Button>
                  </Paper>
                ) : null}

                {confirmedGeo ? (
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold">Confirmed: {formData.delivery_address}</Typography>
                    <Typography variant="caption">Lat: {formData.latitude}, Lng: {formData.longitude}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Button size="small" color="error" onClick={clearAddressConfirmation}>Change</Button>
                    </Box>
                  </Box>
                ) : null}

                {geocodingError && !confirmedGeo ? <Alert severity="error" sx={{ mt: 2 }}>{geocodingError}</Alert> : null}
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">Order Items</Typography>
              <Button startIcon={<Plus size={16} />} onClick={addItem} variant="outlined">Add Item</Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {items.map((item, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={5}><TextField fullWidth required label="Item Name" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} /></Grid>
                  <Grid item xs={6} sm={3}><TextField fullWidth required type="number" label="Quantity" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)} inputProps={{ min: 1 }} /></Grid>
                  <Grid item xs={6} sm={3}><TextField fullWidth required type="number" label="Price" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} inputProps={{ min: 0, step: 0.01 }} /></Grid>
                  <Grid item xs={12} sm={1}><IconButton onClick={() => removeItem(index)} disabled={items.length === 1}><Trash2 size={16} /></IconButton></Grid>
                </Grid>
              </Box>
            ))}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography>Subtotal</Typography><Typography>${totals.subtotal}</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography>Tax (8%)</Typography><Typography>${totals.tax}</Typography></Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography>Delivery Fee</Typography><Typography>${totals.deliveryFee}</Typography></Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6" fontWeight="bold">Total</Typography><Typography variant="h6" fontWeight="bold">${totals.total}</Typography></Box>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">Additional Details</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select required label="Payment Method" name="payment_method" value={formData.payment_method} onChange={handleInputChange}>
                  <MenuItem value="Card">Credit/Debit Card</MenuItem>
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="Digital">Digital Wallet</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={3} label="Special Instructions" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Add any special instructions for the kitchen or driver..." />
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate(-1)} size="large">Cancel</Button>
            <Button type="submit" variant="contained" size="large" disabled={!confirmedGeo}>Create Order</Button>
          </Box>
        </form>
      </Container>
    </Box>
  );
};

export default CreateOrder;
