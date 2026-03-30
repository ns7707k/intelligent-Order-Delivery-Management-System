# Frontend Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager

### Installation Steps

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   copy .env.example .env
   ```
   
   Edit `.env` if needed to match your backend configuration.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to http://localhost:3000

## 📁 What Has Been Created

### Core Files
- ✅ **React Application** with Vite configuration
- ✅ **Material-UI Theme** for consistent styling
- ✅ **React Router** for navigation between Kitchen and Manager views

### Kitchen View (Voice-Activated KDS)
- ✅ `KitchenView.jsx` - Main kitchen interface
- ✅ `OrderCard.jsx` - Individual order cards with fallback touch controls
- ✅ `VoiceIndicator.jsx` - Flashing microphone icon when listening
- ✅ `ConfirmationDialog.jsx` - High-contrast modal for voice command confirmation
- ✅ `voiceRecognition.js` - Web Speech API service with confidence threshold (0.8)
- ✅ `useVoiceRecognition.js` - Custom React hook for voice commands

### Manager Dashboard (Heatmaps)
- ✅ `ManagerDashboard.jsx` - Business intelligence interface
- ✅ `HeatmapView.jsx` - Leaflet.js map with heatmap layer
- ✅ `OrderStats.jsx` - Statistical sidebar with order metrics
- ✅ Live/Predictive view toggle switch

### Shared Components & Services
- ✅ `Navigation.jsx` - Top navigation bar
- ✅ `OrderContext.jsx` - Global order state management with real-time polling
- ✅ `api.js` - Axios service for backend communication
- ✅ `dateUtils.js` - Date formatting utilities

### Configuration Files
- ✅ `package.json` - All dependencies included
- ✅ `vite.config.js` - Development server with proxy to backend
- ✅ `.eslintrc.json` - Code quality rules
- ✅ `theme.js` - Material-UI theme customization
- ✅ `global.css` - Global styles and animations

## 🎯 Key Features Implemented

### Voice-Activated System
- ✅ Web Speech API integration
- ✅ Command pattern recognition: "Order [ID] [Status]"
- ✅ Confidence threshold protocol (0.8)
- ✅ Confirmation loop with visual and audio feedback
- ✅ "I didn't catch that, please repeat" for low confidence
- ✅ Hands-free operation with fallback touch controls

### Manager Dashboard
- ✅ Interactive Leaflet.js map
- ✅ Heatmap visualization with Leaflet.heat
- ✅ Live View (current active orders)
- ✅ Predictive View (historical hotspots)
- ✅ Toggle switch for view mode
- ✅ Real-time synchronization via polling (5-second intervals)
- ✅ Order statistics sidebar

### Responsive Design
- ✅ Adapts to wall-mounted tablets (Kitchen View)
- ✅ Optimized for laptops (Manager Dashboard)
- ✅ Mobile-friendly layouts
- ✅ High contrast for kitchen environments

## 🔌 Backend Integration

The frontend is ready to connect to your Flask backend. It expects these endpoints:

```
GET    /api/orders              # Get all orders
GET    /api/orders/:id          # Get specific order
PATCH  /api/orders/:id          # Update order status
POST   /api/orders              # Create new order
GET    /api/heatmap/live        # Get live heatmap data
GET    /api/heatmap/predictive  # Get historical heatmap data
POST   /api/routes/optimize     # Optimize delivery routes
GET    /api/routes/active       # Get active routes
```

## 🧪 Testing the Voice System

1. **Check Browser Support:**
   - Use Chrome, Edge, or Safari
   - Firefox has limited support

2. **Grant Microphone Permission:**
   - Click the microphone button
   - Allow browser to access microphone

3. **Test Commands:**
   ```
   "Order 123 ready"
   "Order 456 preparing"
   "Mark order 789 as delivered"
   ```

4. **Expected Behavior:**
   - Microphone icon pulses when listening
   - Confidence check (threshold 0.8)
   - Confirmation dialog appears
   - Say "Confirm" or click button
   - Order updates in real-time

## 📱 Testing the Heatmap

1. **Navigate to Manager Dashboard:**
   - Click "Dashboard" in top navigation

2. **Toggle View Modes:**
   - Click "Live View" to see current orders
   - Click "Predictive View" to see historical hotspots

3. **Expected Behavior:**
   - Map displays with markers (Live) or heatmap (Predictive)
   - Stats sidebar shows order counts
   - Updates automatically every 5 seconds

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Run tests (when implemented)
npm test
```

## ⚠️ Known Limitations

1. **Backend Required:** Frontend needs backend API to function (currently will show mock data)
2. **HTTPS Required:** Voice recognition requires HTTPS in production
3. **Browser Support:** Voice features only work in Chrome, Edge, and Safari
4. **Heatmap Data:** Currently uses mock data until backend is connected

## 📚 Next Steps

1. **Connect to Backend:**
   - Ensure backend is running on http://localhost:5000
   - Update `.env` if using different port

2. **Test Integration:**
   - Create test orders via backend
   - Verify voice commands update database
   - Check heatmap displays real coordinates

3. **Customize:**
   - Edit theme colors in `src/styles/theme.js`
   - Adjust voice confidence threshold in service
   - Modify heatmap colors and radius

## 📖 Documentation

- Full documentation: See [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)
- Component details: Check individual component files
- API integration: See [src/services/api.js](./src/services/api.js)

## 🤝 Support

If you encounter issues:
1. Check browser console for errors
2. Verify backend is running
3. Check network tab for failed API calls
4. Ensure microphone permissions are granted
5. Review [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) troubleshooting section

---

**Frontend Status:** ✅ Complete and Ready for Backend Integration

*Created: February 27, 2026*
