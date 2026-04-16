import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Route, Truck, Eye, RefreshCcw } from 'lucide-react';
import L from 'leaflet';
import { getAllRoutes, getDrivers, getRestaurant, getSettings } from '../../services/api';
import { getMapLayerConfig } from '../../utils/mapLayers';
import { mergeRuntimeSettingsIntoCache, readCachedRuntimeSettings } from '../../utils/runtimeSettings';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_ZOOM = 13;

const toCoordinate = (latitude, longitude) => {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return [lat, lng];
};

const createDriverIcon = (status, isSimulatedMoving) => L.divIcon({
  className: 'driver-marker',
  html: `<div style="background:${status === 'on_delivery' ? '#1976d2' : status === 'returning' ? '#ed6c02' : '#2e7d32'};color:#fff;border-radius:999px;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:${isSimulatedMoving ? '0 0 0 6px rgba(25,118,210,0.18), 0 3px 8px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.35)'};font-size:12px;font-weight:700;padding:0 8px;">${status === 'on_delivery' ? '&#128666;' : 'D'}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const formatIsoTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const createStopIcon = (number, color = '#2196f3') => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color:${color};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const buildDriverPopup = (driver) => {
  const container = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = driver.name;
  container.appendChild(title);

  const status = document.createElement('div');
  status.textContent = `Status: ${driver.status}`;
  status.style.marginTop = '4px';
  container.appendChild(status);

  if (driver.current_order_id) {
    const activeOrder = document.createElement('div');
    activeOrder.textContent = `Current order: #${driver.current_order_id}`;
    activeOrder.style.marginTop = '4px';
    container.appendChild(activeOrder);
  }

  const eta = document.createElement('div');
  eta.textContent = `ETA: ${formatIsoTime(driver.estimated_delivery_at)}`;
  eta.style.marginTop = '4px';
  container.appendChild(eta);

  const coords = document.createElement('div');
  coords.textContent = `Coords: ${Number(driver.current_latitude).toFixed(5)}, ${Number(driver.current_longitude).toFixed(5)}`;
  coords.style.marginTop = '4px';
  container.appendChild(coords);

  return container;
};

const buildStopPopup = (stop, index) => {
  const container = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = `Stop ${index + 1}: Order #${stop.id}`;
  container.appendChild(title);

  if (stop.address) {
    const address = document.createElement('div');
    address.textContent = stop.address;
    address.style.marginTop = '4px';
    container.appendChild(address);
  }

  const status = document.createElement('div');
  status.textContent = `Status: ${stop.status}`;
  status.style.marginTop = '4px';
  container.appendChild(status);

  return container;
};

const getRoadRoute = async (stops) => {
  if (!stops.length) {
    return [];
  }

  if (stops.length === 1) {
    return [[stops[0].lat, stops[0].lng]];
  }

  const coordinates = stops.map((stop) => `${stop.lng},${stop.lat}`).join(';');
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch road geometry');
  }

  const payload = await response.json();
  const geometry = payload.routes?.[0]?.geometry?.coordinates;

  if (!geometry) {
    throw new Error('OSRM returned no route geometry');
  }

  return geometry.map(([lng, lat]) => [lat, lng]);
};

const RouteVisualization = () => {
  const navigate = useNavigate();
  const [runtimeSettings, setRuntimeSettings] = useState(() => readCachedRuntimeSettings());
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState(null);
  const [mapCenterReady, setMapCenterReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const driverMarkersRef = useRef({});
  const stopMarkersRef = useRef({});
  const routePolylineRef = useRef(null);
  const roadRequestIdRef = useRef(0);
  const previousSelectedRouteRef = useRef(null);
  const hasAutoFramedRouteRef = useRef(false);

  const resolvedMapZoom = Number.isFinite(Number(runtimeSettings.default_map_zoom))
    ? Math.max(1, Math.min(20, Math.round(Number(runtimeSettings.default_map_zoom))))
    : DEFAULT_ZOOM;
  const pollIntervalMs = Number.isFinite(Number(runtimeSettings.refresh_interval))
    ? Math.max(1000, Math.round(Number(runtimeSettings.refresh_interval) * 1000))
    : 5000;
  const mapLayer = getMapLayerConfig(runtimeSettings.map_style);

  useEffect(() => {
    let active = true;

    const hydrateRuntimeSettings = async () => {
      try {
        const settingsData = await getSettings();
        if (!active || !settingsData || typeof settingsData !== 'object') {
          return;
        }
        setRuntimeSettings(mergeRuntimeSettingsIntoCache(settingsData));
      } catch {
        // Keep cached defaults when settings endpoint fails.
      }
    };

    hydrateRuntimeSettings();

    return () => {
      active = false;
    };
  }, []);

  const fetchRoutes = useCallback(async (background = false) => {
    try {
      if (!background) {
        setLoading(true);
      }
      setError('');

      const [routeData, driverData] = await Promise.all([getAllRoutes(), getDrivers()]);
      const routeList = Array.isArray(routeData) ? routeData : [];

      setRoutes(routeList);
      setDrivers(Array.isArray(driverData) ? driverData : []);
      setSelectedRoute((previousRouteId) => {
        if (previousRouteId && routeList.some((route) => route.id === previousRouteId)) {
          return previousRouteId;
        }

        return routeList[0]?.id || null;
      });
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      setError('Failed to load routes. Please check that the backend is running.');
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchRoutes();

    const intervalId = window.setInterval(() => {
      fetchRoutes(true);
    }, pollIntervalMs);

    getRestaurant()
      .then((data) => {
        const depotCenter = toCoordinate(data?.latitude, data?.longitude);

        if (depotCenter) {
          setMapCenter(depotCenter);
        } else {
          setError((previous) => previous || 'Restaurant depot location is missing. Update it in Settings to render the map.');
        }
      })
      .catch(() => {
        setError((previous) => previous || 'Failed to load restaurant depot location.');
      })
      .finally(() => {
        setMapCenterReady(true);
      });

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchRoutes, pollIntervalMs]);

  const getOrderStatusColor = (status) => {
    const colors = {
      pending: 'default',
      in_transit: 'primary',
      delivered: 'success',
    };
    return colors[status] || 'default';
  };

  const getRouteStatusColor = (status) => {
    const colors = {
      active: 'primary',
      completed: 'success',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  const currentRoute = routes.find(r => r.id === selectedRoute);

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current || !mapCenter) {
      return undefined;
    }

    mapInstanceRef.current = L.map(mapRef.current).setView(mapCenter, resolvedMapZoom);
    tileLayerRef.current = L.tileLayer(mapLayer.url, {
      attribution: mapLayer.attribution,
      maxZoom: mapLayer.maxZoom,
    }).addTo(mapInstanceRef.current);

    return () => {
      Object.values(driverMarkersRef.current).forEach((marker) => marker.remove());
      Object.values(stopMarkersRef.current).forEach((marker) => marker.remove());
      driverMarkersRef.current = {};
      stopMarkersRef.current = {};

      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }

      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.remove();
        restaurantMarkerRef.current = null;
      }

      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [mapCenter, mapLayer.attribution, mapLayer.maxZoom, mapLayer.url, resolvedMapZoom]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    tileLayerRef.current = L.tileLayer(mapLayer.url, {
      attribution: mapLayer.attribution,
      maxZoom: mapLayer.maxZoom,
    }).addTo(map);
  }, [mapLayer.attribution, mapLayer.maxZoom, mapLayer.url]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const restaurantPosition = mapCenter ? toCoordinate(mapCenter[0], mapCenter[1]) : null;

    if (!map || !restaurantPosition) {
      return;
    }

    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.setLatLng(restaurantPosition);
    } else {
      restaurantMarkerRef.current = L.marker(restaurantPosition)
        .bindPopup('Restaurant depot')
        .addTo(map);
    }
  }, [mapCenter]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const nextDriverIds = new Set();

    drivers.forEach((driver) => {
      const position = toCoordinate(driver.current_latitude, driver.current_longitude);

      if (!position) {
        return;
      }

      nextDriverIds.add(driver.id);

      if (driverMarkersRef.current[driver.id]) {
        driverMarkersRef.current[driver.id].setLatLng(position);
        driverMarkersRef.current[driver.id].setIcon(createDriverIcon(driver.status, Boolean(driver.current_order_id && driver.status === 'on_delivery')));
        driverMarkersRef.current[driver.id].setPopupContent(buildDriverPopup(driver));
      } else {
        driverMarkersRef.current[driver.id] = L.marker(position, {
          icon: createDriverIcon(driver.status, Boolean(driver.current_order_id && driver.status === 'on_delivery')),
        })
          .bindPopup(buildDriverPopup(driver))
          .addTo(map);
      }
    });

    Object.entries(driverMarkersRef.current).forEach(([driverId, marker]) => {
      if (!nextDriverIds.has(driverId)) {
        marker.remove();
        delete driverMarkersRef.current[driverId];
      }
    });
  }, [drivers]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return undefined;
    }

    Object.values(stopMarkersRef.current).forEach((marker) => marker.remove());
    stopMarkersRef.current = {};

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (!currentRoute) {
      return undefined;
    }

    const routeStops = (currentRoute.orders || [])
      .map((order, index) => ({
        ...order,
        index,
        position: toCoordinate(order.lat, order.lng),
      }))
      .filter((order) => order.position);

    routeStops.forEach((order) => {
      const color = order.status === 'delivered'
        ? '#4caf50'
        : order.status === 'in_transit'
          ? '#ff9800'
          : '#2196f3';

      stopMarkersRef.current[order.id] = L.marker(order.position, {
        icon: createStopIcon(order.index + 1, color),
      })
        .bindPopup(buildStopPopup(order, order.index))
        .addTo(map);
    });

    const requestId = roadRequestIdRef.current + 1;
    roadRequestIdRef.current = requestId;
    const routeChanged = previousSelectedRouteRef.current !== selectedRoute;
    const shouldAutoFrame = !hasAutoFramedRouteRef.current || routeChanged;

    const fetchRoadGeometry = async () => {
      try {
        const routePoints = [
            mapCenter ? toCoordinate(mapCenter[0], mapCenter[1]) : null,
          ...routeStops.map((order) => order.position),
        ]
          .filter(Boolean)
          .map(([lat, lng]) => ({ lat, lng }));

        if (routePoints.length < 2) {
          if (routeStops.length && shouldAutoFrame) {
            map.fitBounds(L.latLngBounds(routeStops.map((order) => order.position)), { padding: [40, 40] });
            hasAutoFramedRouteRef.current = true;
            previousSelectedRouteRef.current = selectedRoute;
          }
          return;
        }

        const roadCoordinates = await getRoadRoute(routePoints);

        if (roadRequestIdRef.current !== requestId || !mapInstanceRef.current) {
          return;
        }

        routePolylineRef.current = L.polyline(roadCoordinates, {
          color: '#2196f3',
          weight: 4,
          opacity: 0.8,
        }).addTo(map);

        if (shouldAutoFrame) {
          map.fitBounds(L.latLngBounds(roadCoordinates), { padding: [40, 40] });
          hasAutoFramedRouteRef.current = true;
          previousSelectedRouteRef.current = selectedRoute;
        }
      } catch (err) {
        console.error('Failed to fetch road route geometry:', err);

        const fallbackCoordinates = routeStops.map((order) => order.position);
        if (!fallbackCoordinates.length || roadRequestIdRef.current !== requestId || !mapInstanceRef.current) {
          return;
        }

        routePolylineRef.current = L.polyline(fallbackCoordinates, {
          color: '#2196f3',
          weight: 4,
          opacity: 0.8,
          dashArray: '8 8',
        }).addTo(map);

        if (shouldAutoFrame) {
          map.fitBounds(L.latLngBounds(fallbackCoordinates), { padding: [40, 40] });
          hasAutoFramedRouteRef.current = true;
          previousSelectedRouteRef.current = selectedRoute;
        }
      }
    };

    fetchRoadGeometry();

    return () => {
      roadRequestIdRef.current += 1;
    };
  }, [currentRoute, mapCenter, selectedRoute]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Route size={24} />
              Route Visualization
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Track optimized paths from depot to delivery stops in real time
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshCcw size={16} />} onClick={fetchRoutes} disabled={loading}>
            Refresh Routes
          </Button>
        </Box>

        {/* Statistics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Active Routes
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {routes.filter(r => r.status === 'active').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Total Orders
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {routes.reduce((sum, r) => sum + (r.orders?.length || r.total_orders || 0), 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Total Distance
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {routes.reduce((sum, r) => sum + (r.total_distance || 0), 0).toFixed(1)} km
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  Est. Total Time
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {routes.reduce((sum, r) => sum + (r.estimated_time || 0), 0)} min
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : routes.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No routes found. Routes are created automatically when orders are marked as "Ready".
            </Typography>
          </Paper>
        ) : (
        <Grid container spacing={3}>
          {/* Route List */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Routes ({routes.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List>
                {routes.map((route) => (
                  <Card
                    key={route.id}
                    sx={{
                      mb: 2,
                      cursor: 'pointer',
                      border: selectedRoute === route.id ? '2px solid' : '1px solid',
                      borderColor: selectedRoute === route.id ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setSelectedRoute(route.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {route.id}
                        </Typography>
                        <Chip
                          label={route.status.toUpperCase()}
                          color={getRouteStatusColor(route.status)}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Truck size={14} color="#6B7280" />
                        <Typography variant="body2">
                          {route.driver_name} ({route.driver_id})
                        </Typography>
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {(route.orders?.length || route.total_orders || 0)} stops • {route.total_distance || 0} km • {route.estimated_time || 0} min
                      </Typography>

                      <List dense sx={{ mt: 1 }}>
                        {(route.orders || []).map((order, index) => (
                          <ListItem 
                            key={order.id} 
                            sx={{ 
                              px: 0, 
                              py: 0.5,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/orders/${order.id}`);
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="caption">
                                  {index + 1}. Order #{order.id}
                                </Typography>
                              }
                              secondary={
                                <Chip
                                  label={order.status}
                                  color={getOrderStatusColor(order.status)}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              }
                            />
                          </ListItem>
                        ))}
                      </List>

                      <Button
                        size="small"
                        startIcon={<Eye size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoute(route.id);
                        }}
                        sx={{ mt: 1 }}
                      >
                        View on Map
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Map */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 0, height: '70vh', overflow: 'hidden', position: 'relative' }}>
              <Box ref={mapRef} sx={{ height: '100%', width: '100%' }} />
              {mapCenterReady && !mapCenter && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.75)',
                    zIndex: 2,
                    px: 3,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Set restaurant latitude and longitude to visualize routes.
                  </Typography>
                </Box>
              )}
              {!currentRoute && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.75)',
                    zIndex: 1,
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Select a route to view on map
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
        )}
      </Container>
    </Box>
  );
};

export default RouteVisualization;
