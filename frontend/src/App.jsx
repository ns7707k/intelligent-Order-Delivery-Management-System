import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { OrderProvider } from './contexts/OrderContext';
import { useAuth } from './contexts/AuthContext';
import Navigation from './components/common/Navigation';
import Login from './components/auth/Login';

const KitchenView = lazy(() => import('./components/kitchen/KitchenView'));
const ManagerDashboard = lazy(() => import('./components/manager/ManagerDashboard'));
const OrderDetails = lazy(() => import('./components/orders/OrderDetails'));
const CreateOrder = lazy(() => import('./components/orders/CreateOrder'));
const OrderHistory = lazy(() => import('./components/orders/OrderHistory'));
const DriverManagement = lazy(() => import('./components/drivers/DriverManagement'));
const DriverDetails = lazy(() => import('./components/drivers/DriverDetails'));
const DriverLayout = lazy(() => import('./components/drivers/DriverLayout'));
const DriverDashboard = lazy(() => import('./components/drivers/DriverDashboard'));
const DriverDeliveryView = lazy(() => import('./components/drivers/DriverDeliveryView'));
const DriverHistory = lazy(() => import('./components/drivers/DriverHistory'));
const DriverProfile = lazy(() => import('./components/drivers/DriverProfile'));
const RouteVisualization = lazy(() => import('./components/routes/RouteVisualization'));
const Analytics = lazy(() => import('./components/analytics/Analytics'));
const Settings = lazy(() => import('./components/settings/Settings'));

function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function RoleRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'restaurant_admin') {
    return <Navigate to="/kitchen" replace />;
  }
  if (user.role === 'driver') {
    return <Navigate to="/driver/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageSpinner />;
  }

  const showNavigation = Boolean(user) && user.role === 'restaurant_admin' &&
    !['/login', '/register'].includes(location.pathname);

  return (
    <OrderProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {showNavigation ? <Navigation /> : null}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Suspense fallback={<FullPageSpinner />}>
            <Routes>
              <Route path="/" element={<RoleRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="/register/restaurant" element={<Navigate to="/login" replace />} />
              <Route path="/register/driver" element={<Navigate to="/login" replace />} />

              <Route element={<ProtectedRoute allowedRoles={['restaurant_admin']} />}>
                <Route path="/kitchen" element={<KitchenView />} />
                <Route path="/dashboard" element={<ManagerDashboard />} />
                <Route path="/manager" element={<Navigate to="/dashboard" replace />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/orders/create" element={<CreateOrder />} />
                <Route path="/orders/:orderId" element={<OrderDetails />} />
                <Route path="/drivers" element={<DriverManagement />} />
                <Route path="/drivers/:driverId" element={<DriverDetails />} />
                <Route path="/routes" element={<RouteVisualization />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['driver']} />}>
                <Route element={<DriverLayout />}>
                  <Route path="/driver/dashboard" element={<DriverDashboard />} />
                  <Route path="/driver/delivery/:orderId" element={<DriverDeliveryView />} />
                  <Route path="/driver/history" element={<DriverHistory />} />
                  <Route path="/driver/profile" element={<DriverProfile />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Box>
      </Box>
    </OrderProvider>
  );
}

export default App;
