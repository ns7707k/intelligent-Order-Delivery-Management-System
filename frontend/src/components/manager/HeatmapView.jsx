import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import L from 'leaflet';
import 'leaflet.heat';
import { getMapLayerConfig } from '../../utils/mapLayers';
import { DEFAULT_MAP_CENTER } from '../../utils/runtimeSettings';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_ZOOM = 13;
const DEFAULT_CENTER = DEFAULT_MAP_CENTER;

const toCoordinate = (latitude, longitude) => {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return [lat, lng];
};

const normalizeIntensity = (value) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0.5;
  }
  return Math.min(Math.max(parsed, 0), 1);
};

const stylePopupButton = (button, palette = 'primary') => {
  const schemes = {
    primary: { background: '#1D4ED8', color: '#FFFFFF', border: '#1D4ED8' },
    neutral: { background: '#FFFFFF', color: '#0F172A', border: '#94A3B8' },
    accent: { background: '#0F766E', color: '#FFFFFF', border: '#0F766E' },
  };

  const scheme = schemes[palette] || schemes.primary;
  button.style.height = '30px';
  button.style.padding = '0 10px';
  button.style.borderRadius = '999px';
  button.style.border = `1px solid ${scheme.border}`;
  button.style.background = scheme.background;
  button.style.color = scheme.color;
  button.style.fontSize = '12px';
  button.style.fontWeight = '700';
  button.style.whiteSpace = 'nowrap';
};

const createMarkerIcon = ({ background, label, selected = false }) => L.divIcon({
  className: 'dashboard-map-marker',
  html: `<div style="width:${selected ? 34 : 30}px;height:${selected ? 34 : 30}px;border-radius:50%;background:${background};border:2px solid #FFFFFF;box-shadow:${selected ? '0 0 0 6px rgba(37,99,235,0.22), 0 8px 18px rgba(15,23,42,0.35)' : '0 6px 14px rgba(15,23,42,0.28)'};display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:800;font-size:12px;">${label}</div>`,
  iconSize: [selected ? 34 : 30, selected ? 34 : 30],
  iconAnchor: [selected ? 17 : 15, selected ? 17 : 15],
});

const createRestaurantIcon = () => createMarkerIcon({ background: '#0F172A', label: 'R' });

const createOrderIcon = (selected = false) => createMarkerIcon({
  background: selected ? '#1D4ED8' : '#0EA5E9',
  label: 'O',
  selected,
});

const createPopupContent = (point, orderId, navigate, restaurantLocation, onSelectOrder) => {
  const container = document.createElement('div');

  const title = document.createElement('strong');
  title.textContent = `Order #${orderId ?? 'N/A'}`;
  container.appendChild(title);

  if (point.status) {
    const status = document.createElement('div');
    status.textContent = `Status: ${point.status}`;
    status.style.marginTop = '4px';
    container.appendChild(status);
  }

  if (point.address) {
    const address = document.createElement('div');
    address.textContent = point.address;
    address.style.marginTop = '4px';
    container.appendChild(address);
  }

  if (orderId) {
    const viewOrderButton = document.createElement('button');
    viewOrderButton.type = 'button';
    viewOrderButton.textContent = 'View order';
    viewOrderButton.style.marginTop = '8px';
    viewOrderButton.style.cursor = 'pointer';
    stylePopupButton(viewOrderButton, 'primary');
    viewOrderButton.onclick = () => navigate(`/orders/${orderId}`);
    container.appendChild(viewOrderButton);

    const viewRouteButton = document.createElement('button');
    viewRouteButton.type = 'button';
    viewRouteButton.textContent = 'View route on map';
    viewRouteButton.style.marginTop = '8px';
    viewRouteButton.style.marginLeft = '8px';
    viewRouteButton.style.cursor = 'pointer';
    stylePopupButton(viewRouteButton, 'neutral');
    viewRouteButton.onclick = () => onSelectOrder?.(Number(orderId));
    container.appendChild(viewRouteButton);
  }

  const destination = toCoordinate(point.lat, point.lng);
  if (destination) {
    const mapsButton = document.createElement('button');
    mapsButton.type = 'button';
    mapsButton.textContent = 'Open in Google Maps';
    mapsButton.style.marginTop = '8px';
    mapsButton.style.marginLeft = orderId ? '8px' : '0';
    mapsButton.style.cursor = 'pointer';
    stylePopupButton(mapsButton, 'accent');
    mapsButton.onclick = () => {
      const origin = restaurantLocation
        ? `&origin=${restaurantLocation[0]},${restaurantLocation[1]}`
        : '';
      window.open(
        `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination[0]},${destination[1]}`,
        '_blank',
        'noopener,noreferrer'
      );
    };
    container.appendChild(mapsButton);
  }

  return container;
};

const HeatmapView = ({
  data,
  viewMode,
  loading,
  restaurantLocation,
  selectedOrderId,
  onSelectOrder,
  mapZoom,
  mapStyle,
}) => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const orderMarkersRef = useRef({});
  const selectedRouteRef = useRef(null);
  const hasAutoFramedRef = useRef(false);
  const previousViewModeRef = useRef(viewMode);

  const selectedPoint = useMemo(() => {
    if (!selectedOrderId) {
      return null;
    }
    return (data || []).find((point) => Number(point.order_id ?? point.orderId) === Number(selectedOrderId)) || null;
  }, [data, selectedOrderId]);

  const resolvedMapZoom = Number.isFinite(Number(mapZoom))
    ? Math.max(1, Math.min(20, Math.round(Number(mapZoom))))
    : DEFAULT_ZOOM;

  const mapLayer = getMapLayerConfig(mapStyle);

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) {
      return undefined;
    }

    const initialCenter = restaurantLocation
      ? toCoordinate(restaurantLocation[0], restaurantLocation[1])
      : null;

    mapInstanceRef.current = L.map(mapRef.current).setView(initialCenter || DEFAULT_CENTER, resolvedMapZoom);

    tileLayerRef.current = L.tileLayer(mapLayer.url, {
      attribution: mapLayer.attribution,
      maxZoom: mapLayer.maxZoom,
    }).addTo(mapInstanceRef.current);

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 0);

    return () => {
      Object.values(orderMarkersRef.current).forEach((marker) => marker.remove());
      orderMarkersRef.current = {};

      if (heatLayerRef.current) {
        heatLayerRef.current.remove();
        heatLayerRef.current = null;
      }

      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      if (selectedRouteRef.current) {
        selectedRouteRef.current.remove();
        selectedRouteRef.current = null;
      }

      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.remove();
        restaurantMarkerRef.current = null;
      }

      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [restaurantLocation, mapLayer.attribution, mapLayer.maxZoom, mapLayer.url, resolvedMapZoom]);

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
    const location = restaurantLocation ? toCoordinate(restaurantLocation[0], restaurantLocation[1]) : null;

    if (!map) {
      return;
    }

    if (!location) {
      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.remove();
        restaurantMarkerRef.current = null;
      }
      return;
    }

    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.setLatLng(location);
      if (restaurantMarkerRef.current.getTooltip()) {
        restaurantMarkerRef.current.setTooltipContent('Restaurant depot');
      } else {
        restaurantMarkerRef.current.bindTooltip('Restaurant depot', {
          direction: 'top',
          offset: [0, -12],
          opacity: 0.95,
        });
      }
    } else {
      restaurantMarkerRef.current = L.marker(location, { icon: createRestaurantIcon() })
        .bindPopup('Restaurant location')
        .bindTooltip('Restaurant depot', {
          direction: 'top',
          offset: [0, -12],
          opacity: 0.95,
        })
        .addTo(map);
    }
  }, [restaurantLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const points = (data || [])
      .map((point) => {
        const position = toCoordinate(point.lat, point.lng);

        if (!position) {
          return null;
        }

        return [...position, normalizeIntensity(point.intensity)];
      })
      .filter(Boolean);

    if (!points.length) {
      return;
    }

    heatLayerRef.current = L.heatLayer(points, {
      radius: 35,
      blur: 20,
      maxZoom: 15,
      max: 1.0,
      gradient: {
        0.4: 'blue',
        0.6: 'lime',
        0.8: 'yellow',
        1.0: 'red',
      },
    }).addTo(map);
  }, [data, viewMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    if (viewMode !== 'live') {
      Object.values(orderMarkersRef.current).forEach((marker) => marker.remove());
      orderMarkersRef.current = {};
      return;
    }

    const nextMarkerIds = new Set();

    (data || []).forEach((point, index) => {
      const position = toCoordinate(point.lat, point.lng);
      if (!position) {
        return;
      }

      const orderId = point.order_id ?? point.orderId ?? index;
      const markerId = String(orderId);
      nextMarkerIds.add(markerId);
      const isSelected = Number(orderId) === Number(selectedOrderId);
      const markerLabel = `Order #${orderId} (${String(point.status || 'unknown').replaceAll('_', ' ')})`;

      const popupContent = createPopupContent(point, orderId, navigate, restaurantLocation, onSelectOrder);

      if (orderMarkersRef.current[markerId]) {
        orderMarkersRef.current[markerId].setLatLng(position);
        orderMarkersRef.current[markerId].setIcon(createOrderIcon(isSelected));
        if (orderMarkersRef.current[markerId].getTooltip()) {
          orderMarkersRef.current[markerId].setTooltipContent(markerLabel);
        } else {
          orderMarkersRef.current[markerId].bindTooltip(markerLabel, {
            direction: 'top',
            offset: [0, -10],
            opacity: 0.95,
          });
        }
        orderMarkersRef.current[markerId].setPopupContent(popupContent);
      } else {
        orderMarkersRef.current[markerId] = L.marker(position, { icon: createOrderIcon(isSelected) })
          .bindTooltip(markerLabel, {
            direction: 'top',
            offset: [0, -10],
            opacity: 0.95,
          })
          .bindPopup(popupContent)
          .addTo(map);
      }
    });

    Object.entries(orderMarkersRef.current).forEach(([markerId, marker]) => {
      if (!nextMarkerIds.has(markerId)) {
        marker.remove();
        delete orderMarkersRef.current[markerId];
      }
    });
  }, [data, navigate, onSelectOrder, restaurantLocation, selectedOrderId, viewMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const restaurantPoint = restaurantLocation ? toCoordinate(restaurantLocation[0], restaurantLocation[1]) : null;
    const destinationPoint = selectedPoint ? toCoordinate(selectedPoint.lat, selectedPoint.lng) : null;

    if (!map) {
      return;
    }

    if (selectedRouteRef.current) {
      selectedRouteRef.current.remove();
      selectedRouteRef.current = null;
    }

    if (!restaurantPoint || !destinationPoint || viewMode !== 'live') {
      return;
    }

    selectedRouteRef.current = L.polyline([restaurantPoint, destinationPoint], {
      color: '#0F172A',
      weight: 4,
      opacity: 0.9,
      dashArray: '6 8',
    }).addTo(map);

    map.fitBounds(L.latLngBounds([restaurantPoint, destinationPoint]), { padding: [44, 44] });
  }, [restaurantLocation, selectedPoint, viewMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const liveBounds = (data || [])
      .map((point) => toCoordinate(point.lat, point.lng))
      .filter(Boolean);

    const boundsPoints = restaurantLocation
      ? [...liveBounds, toCoordinate(restaurantLocation[0], restaurantLocation[1])].filter(Boolean)
      : liveBounds;

    const viewModeChanged = previousViewModeRef.current !== viewMode;
    const shouldAutoFrame = !hasAutoFramedRef.current || viewModeChanged;

    if (!shouldAutoFrame || selectedPoint) {
      return;
    }

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], resolvedMapZoom);
      hasAutoFramedRef.current = true;
      previousViewModeRef.current = viewMode;
      return;
    }

    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40] });
      hasAutoFramedRef.current = true;
      previousViewModeRef.current = viewMode;
      return;
    }

    map.setView(DEFAULT_CENTER, resolvedMapZoom);
    hasAutoFramedRef.current = true;
    previousViewModeRef.current = viewMode;
  }, [data, restaurantLocation, resolvedMapZoom, selectedPoint, viewMode]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 2,
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography variant="body2">Loading map data...</Typography>
        </Box>
      )}

      <Box ref={mapRef} sx={{ height: '100%', width: '100%' }} />

      {!loading && (!data || data.length === 0) && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            bgcolor: 'background.paper',
            p: 3,
            borderRadius: 2,
            boxShadow: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No {viewMode === 'live' ? 'active orders' : 'historical data'} to display
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HeatmapView;
