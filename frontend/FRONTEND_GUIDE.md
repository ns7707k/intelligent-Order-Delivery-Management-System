# Frontend Development Guide

## Overview
This document provides a comprehensive guide to the ODMS (Order and Delivery Management System) frontend architecture, components, and development workflow.

## Architecture

### Technology Stack
- **Framework**: React.js 18 with Vite for fast development
- **UI Library**: Material-UI (MUI v5) for consistent, accessible components
- **Mapping**: Leaflet.js with Leaflet.heat for heatmap visualization
- **Voice**: Web Speech API (native browser capability)
- **HTTP Client**: Axios for API communication
- **Routing**: React Router v6
- **State Management**: React Context API

### Project Structure
```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── common/       # Shared components (Navigation, etc.)
│   │   ├── kitchen/      # Kitchen View components
│   │   └── manager/      # Manager Dashboard components
│   ├── contexts/         # React Context providers
│   │   └── OrderContext.jsx
│   ├── hooks/            # Custom React hooks
│   │   └── useVoiceRecognition.js
│   ├── services/         # API and external services
│   │   ├── api.js
│   │   └── voiceRecognition.js
│   ├── styles/           # Global styles and theme
│   │   ├── global.css
│   │   └── theme.js
│   ├── utils/            # Utility functions
│   │   └── dateUtils.js
│   ├── App.jsx           # Main application component
│   └── main.jsx          # Application entry point
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
└── .eslintrc.json        # ESLint configuration
```

## Core Features

### 1. Voice-Activated Kitchen Display System (KDS)

#### Components
- **KitchenView.jsx**: Main container for kitchen interface
- **OrderCard.jsx**: Individual order display cards
- **VoiceIndicator.jsx**: Visual feedback for listening state
- **ConfirmationDialog.jsx**: High-contrast confirmation overlay

#### Voice Recognition Flow
1. User clicks microphone button or it auto-starts
2. System listens for command pattern: "Order [ID] [Status]"
3. Web Speech API processes audio and returns transcript with confidence score
4. If confidence ≥ 0.8: Show confirmation dialog
5. If confidence < 0.8: Speak "I didn't catch that, please repeat"
6. User confirms verbally or with button
7. Update order status via API

#### Voice Commands
Supported patterns:
- "Order 123 ready"
- "System order 456 preparing"
- "Mark order 789 as delivered"

Supported statuses:
- `preparing`
- `ready`
- `delivered`
- `cancelled`

#### Implementation Details
```javascript
// Voice Recognition Service
const service = new VoiceRecognitionService();
service.startListening(onResult, onError, onStateChange);

// Custom Hook
const { isListening, startListening, stopListening, speak } = useVoiceRecognition();
```

### 2. Manager Dashboard with Heatmaps

#### Components
- **ManagerDashboard.jsx**: Main container with view toggle
- **HeatmapView.jsx**: Leaflet.js map with heatmap layer
- **OrderStats.jsx**: Statistical sidebar with order metrics

#### View Modes
1. **Live View**: 
   - Shows current active orders as markers
   - Heatmap intensity based on order density
   - Updates in real-time via polling

2. **Predictive View**:
   - Shows historical hotspots
   - Heatmap based on aggregated historical data
   - Helps identify high-demand zones

#### Heatmap Configuration
```javascript
L.heatLayer(data, {
  radius: 25,          // Radius of each data point
  blur: 35,            // Amount of blur
  maxZoom: 17,         // Max zoom before heatmap updates
  max: 1.0,            // Maximum point intensity
  gradient: {          // Color gradient
    0.0: 'blue',
    0.5: 'lime',
    0.7: 'yellow',
    1.0: 'red'
  }
});
```

### 3. Real-Time Updates

The application uses polling to simulate real-time updates:
- Orders fetched every 5 seconds
- Map data refreshes on view mode change
- Context provider manages global order state

Future implementation can use WebSockets for true real-time updates.

## State Management

### OrderContext
Central state management for orders:

```javascript
const {
  orders,              // Array of all orders
  loading,             // Loading state
  error,               // Error message
  updateOrder,         // Update order status
  refreshOrders,       // Manually refresh orders
  getOrdersByStatus,   // Filter orders by status
  getPendingOrders,    // Get active orders
} = useOrders();
```

## API Integration

### Endpoints
```javascript
// Orders
GET    /api/orders              // Get all orders
GET    /api/orders/:id          // Get specific order
PATCH  /api/orders/:id          // Update order status
POST   /api/orders              // Create new order

// Heatmap
GET    /api/heatmap/live        // Get live heatmap data
GET    /api/heatmap/predictive  // Get historical heatmap data

// Routes
POST   /api/routes/optimize     // Optimize delivery routes
GET    /api/routes/active       // Get active routes
```

### API Service Usage
```javascript
import { getOrders, updateOrderStatus } from './services/api';

// Fetch orders
const orders = await getOrders();

// Update order
const updated = await updateOrderStatus(orderId, 'ready');
```

## Responsive Design

### Breakpoints
- **xs**: 0px (mobile)
- **sm**: 600px (tablet portrait)
- **md**: 960px (tablet landscape)
- **lg**: 1280px (laptop)
- **xl**: 1920px (desktop)

### Kitchen View Optimizations
- Larger touch targets for tablet use
- High contrast for kitchen lighting
- Larger fonts for readability
- Portrait orientation support

### Manager Dashboard Optimizations
- Hides stats sidebar on smaller screens
- Responsive toggle button layout
- Full-width map on mobile

## Styling

### Theme Customization
Edit [theme.js](src/styles/theme.js):
```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});
```

### Global Styles
Edit [global.css](src/styles/global.css) for custom animations and utility classes.

## Development Workflow

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
Access at: http://localhost:3000

### Build for Production
```bash
npm run build
```
Output in `dist/` folder

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

## Browser Compatibility

### Web Speech API Support
- ✅ Chrome 33+
- ✅ Edge 79+
- ✅ Safari 14.1+
- ❌ Firefox (limited support)

### Recommended Browsers
- Chrome (best performance)
- Edge (best performance)
- Safari (iOS support)

## Performance Optimization

### Best Practices
1. **Lazy Loading**: Consider code-splitting for routes
2. **Memoization**: Use `useMemo` for expensive calculations
3. **Debouncing**: Debounce voice commands and API calls
4. **Image Optimization**: Use optimized marker icons
5. **Map Performance**: Limit heatmap data points (< 1000 for smooth rendering)

### Monitoring
- React DevTools for component profiling
- Chrome DevTools for performance analysis
- Lighthouse for accessibility and performance audits

## Accessibility

- Material-UI components are WCAG 2.1 compliant
- Voice commands provide hands-free alternative
- High contrast mode support
- Keyboard navigation enabled
- ARIA labels on interactive elements

## Troubleshooting

### Voice Recognition Not Working
1. Check browser support
2. Ensure HTTPS (required for microphone access)
3. Grant microphone permissions
4. Check console for errors

### Map Not Displaying
1. Verify Leaflet CSS is loaded
2. Check network requests for tile errors
3. Ensure valid lat/lng coordinates
4. Check browser console for errors

### API Connection Issues
1. Verify backend is running on port 5000
2. Check CORS configuration
3. Verify API_BASE_URL in .env
4. Check network tab for failed requests

## Future Enhancements

1. **WebSocket Integration**: Replace polling with real-time WebSocket updates
2. **Progressive Web App (PWA)**: Add service worker for offline support
3. **Push Notifications**: Alert managers of new orders
4. **Multi-language Support**: i18n for voice commands
5. **Advanced Filters**: Filter orders by date, status, customer
6. **Route Visualization**: Show driver routes on map
7. **Analytics Dashboard**: Charts and metrics for business insights

## Contributing

### Code Style
- Use functional components with hooks
- Follow Material-UI patterns
- Write descriptive prop names
- Add JSDoc comments for complex functions
- Use meaningful variable names

### Component Structure
```javascript
/**
 * Component description
 * @param {Object} props - Component props
 */
const MyComponent = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => {}, []);
  
  // Handlers
  const handleClick = () => {};
  
  // Render
  return <div>...</div>;
};

export default MyComponent;
```

## Resources

- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Vite Documentation](https://vitejs.dev/)

---

*Last Updated: February 27, 2026*
