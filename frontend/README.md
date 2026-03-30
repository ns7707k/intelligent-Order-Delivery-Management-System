# ODMS Frontend

Intelligent Order and Delivery Management System - Frontend Module

## Overview
This is the React.js frontend for the ODMS that provides:
- **Voice-Activated Kitchen Display System (KDS)**: Hands-free order management using Web Speech API
- **Manager Dashboard**: Real-time order tracking with predictive heatmaps using Leaflet.js

## Tech Stack
- **Framework**: React.js 18 with Vite
- **UI Library**: Material-UI (MUI)
- **Mapping**: Leaflet.js with heatmap layer
- **Voice**: Web Speech API (native browser)
- **State Management**: React Context API
- **HTTP Client**: Axios

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will run on http://localhost:3000

### Build
```bash
npm run build
```

### Testing
```bash
npm test
```

## Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── kitchen/        # Kitchen View components
│   └── manager/        # Manager Dashboard components
├── hooks/              # Custom React hooks
├── services/           # API and voice services
├── contexts/           # React Context providers
├── utils/              # Utility functions
├── styles/             # Global styles
└── App.jsx             # Main application component
```

## Key Features

### Kitchen View
- Voice-activated order status updates
- Visual listening indicator
- Confidence threshold protocol (0.8)
- Confirmation loop for voice commands
- Fallback touch controls

### Manager Dashboard
- Interactive Leaflet.js map
- Real-time order visualization
- Predictive heatmap from historical data
- Live/Predictive view toggle
- WebSocket real-time updates

## Browser Compatibility
Requires browsers with Web Speech API support:
- Chrome 33+
- Edge 79+
- Safari 14.1+

## Environment Variables
Create a `.env` file in the root directory:
```
VITE_API_BASE_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```
