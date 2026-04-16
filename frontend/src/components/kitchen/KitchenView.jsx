import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Fab,
  Alert,
  Snackbar,
  Button,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import { Mic, MicOff, Plus } from 'lucide-react';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import { useOrders } from '../../contexts/OrderContext';
import { getRestaurant, getSettings, optimizeRoute } from '../../services/api';
import OrderCard from './OrderCard';
import { mergeRuntimeSettingsIntoCache, readCachedRuntimeSettings } from '../../utils/runtimeSettings';

/**
 * Kitchen View - Voice-Activated Kitchen Display System
 * Hands-free order management interface for chefs with live captions
 */
const KitchenView = () => {
  const navigate = useNavigate();
  const { orders, updateOrder, getPendingOrders, refreshOrders } = useOrders();
  const [runtimeSettings, setRuntimeSettings] = useState(() => readCachedRuntimeSettings());
  
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [pendingCommand, setPendingCommand] = useState(null);
  const [showConfirmationUI, setShowConfirmationUI] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const processVoiceCommandRef = useRef(null);
  const autoStartedRef = useRef(false);

  // Check browser support
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(supported);
  }, []);

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

  useEffect(() => {
    getRestaurant()
      .then((restaurant) => {
        if (restaurant?.latitude !== null && restaurant?.longitude !== null) {
          setRestaurantLocation([restaurant.latitude, restaurant.longitude]);
        }
      })
      .catch(() => {});
  }, []);

  // Text-to-speech helper
  const speak = (text) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      synthRef.current.speak(utterance);
    }
  };

  // Initialize advanced voice recognition with live transcript.
  useEffect(() => {
    if (!isSupported || !window.webkitSpeechRecognition) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript = transcript;
          processVoiceCommandRef.current?.(
            transcript.trim(),
            Number(event.results[i][0].confidence)
          );
        } else {
          interimTranscript += transcript;
        }
      }

      // Update live transcript
      setLiveTranscript(interimTranscript || finalTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognitionRef.current = recognition;

    if (runtimeSettings.voice_auto_start && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setIsListening(true);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isSupported, runtimeSettings.voice_auto_start]);

  // Start/stop listening
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        setLiveTranscript('');
        recognitionRef.current.start();
      } catch (error) {
        // If already started, just continue
        if (error.message !== 'recognition already started') {
          console.error('Error starting recognition:', error);
        }
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      setLiveTranscript('');
    }
  }, [isListening]);

  // Keep processVoiceCommand ref always pointing to the latest closure
  useEffect(() => {
    processVoiceCommandRef.current = processVoiceCommand;
  });

  // ─── Word-to-number map (handles speech recognition homophones) ───
  const wordToNumber = {
    'zero': '0', 'oh': '0',
    'one': '1', 'won': '1', 'wan': '1',
    'two': '2', 'to': '2', 'too': '2', 'tu': '2',
    'three': '3', 'tree': '3', 'free': '3',
    'four': '4', 'for': '4', 'fore': '4', 'forth': '4',
    'five': '5', 'hive': '5',
    'six': '6', 'sicks': '6', 'sics': '6',
    'seven': '7',
    'eight': '8', 'ate': '8',
    'nine': '9', 'nein': '9', 'dine': '9',
    'ten': '10', 'tin': '10',
    'eleven': '11', 'twelve': '12', 'thirteen': '13',
    'fourteen': '14', 'fifteen': '15', 'sixteen': '16',
    'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
    'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50',
  };

  /**
   * Replace number-words and homophones with digits in a transcript.
   * Examples: "order four ready" → "order 4 ready"
   *           "order for ready" → "order 4 ready"
   *           "order twenty one ready" → "order 21 ready"
   */
  const normalizeNumbers = (text) => {
    let normalized = text.toLowerCase();

    // Handle compound numbers: "twenty one" → "21", "thirty four" → "34"
    const tens = { 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50 };
    const units = {
      'one': 1, 'won': 1, 'two': 2, 'to': 2, 'too': 2, 'three': 3,
      'four': 4, 'for': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8,
      'ate': 8, 'nine': 9,
    };
    for (const [tensWord, tensVal] of Object.entries(tens)) {
      for (const [unitWord, unitVal] of Object.entries(units)) {
        const pattern = new RegExp(`\\b${tensWord}[\\s-]${unitWord}\\b`, 'gi');
        normalized = normalized.replace(pattern, String(tensVal + unitVal));
      }
    }

    // Handle single number words (replace only in "order X" context first)
    // This prevents replacing common words like "to"/"for" in normal speech
    // Pattern: after "order" + optional whitespace/symbols → word → space → status
    const statusWords = 'ready|prepared|preparing|complete|completed|done|delivered|cancelled|canceled';
    for (const [word, digit] of Object.entries(wordToNumber)) {
      // Only replace homophones of common words (to, for, ate, etc.) when near "order"
      const isCommonWord = ['to', 'too', 'for', 'fore', 'ate', 'won', 'free', 'tree', 'oh', 'tin'].includes(word);
      if (isCommonWord) {
        const contextPattern = new RegExp(
          `(order\\s*(?:#|number|no\\.?)?\\s*)\\b${word}\\b(\\s+(?:is\\s+)?(?:${statusWords}))`,
          'gi'
        );
        normalized = normalized.replace(contextPattern, `$1${digit}$2`);
      } else {
        // Safe number words (one→1, seven→7, etc.) can be replaced globally
        const globalPattern = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(globalPattern, digit);
      }
    }

    return normalized;
  };

  const applyOrderStatusUpdate = async (order, nextStatus) => {
    try {
      const result = await updateOrder(order.id, nextStatus);
      await refreshOrders();

      if (result && result.allocation && result.allocation.assigned_driver) {
        const driverName = result.allocation.assigned_driver.name;
        const deliveryEta = result.allocation.estimated_delivery_time;
        const roundTrip = result.allocation.estimated_round_trip;
        speak(`Order ${order.id} is ready. Driver ${driverName} assigned. Delivery in ${deliveryEta} minutes. Back in ${roundTrip} minutes total.`);
        showNotification(
          `Order #${order.id} -> Ready -> Driver ${driverName} (Deliver: ${deliveryEta}min, Round-trip: ${roundTrip}min)`,
          'success'
        );
      } else {
        speak(`Order ${order.id} updated to ${nextStatus}`);
        showNotification(`Order #${order.id} updated to ${nextStatus}`, 'success');
      }

      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      speak('Error updating order');
      showNotification('Failed to update order', 'error');
      return false;
    }
  };

  // Process voice command
  const processVoiceCommand = (transcript, confidenceScore = null) => {
    const minimumConfidence = Number.isFinite(Number(runtimeSettings.voice_confidence_threshold))
      ? Math.max(0, Math.min(1, Number(runtimeSettings.voice_confidence_threshold)))
      : 0.8;
    const hasConfidenceScore = Number.isFinite(confidenceScore) && confidenceScore > 0;

    if (hasConfidenceScore && confidenceScore < minimumConfidence) {
      const requiredPct = Math.round(minimumConfidence * 100);
      const heardPct = Math.round(confidenceScore * 100);
      showNotification(
        `Low confidence (${heardPct}%). Minimum required is ${requiredPct}%. Please repeat.`,
        'warning'
      );
      speak('I am not confident enough. Please repeat your command.');
      return;
    }

    // Normalize number words/homophones BEFORE matching
    const normalizedTranscript = normalizeNumbers(transcript);
    const lowerTranscript = normalizedTranscript.toLowerCase();
    
    // Add to history (show both original and normalized)
    setTranscriptHistory(prev => [...prev.slice(-4), {
      text:
        transcript
        + (normalizedTranscript !== transcript.toLowerCase() ? ` -> "${normalizedTranscript}"` : '')
        + (hasConfidenceScore ? ` (${Math.round(confidenceScore * 100)}%)` : ''),
      timestamp: new Date(),
    }]);

    // Check if waiting for confirmation
    if (runtimeSettings.voice_confirmation_required && waitingForConfirmation && pendingCommand) {
      if (lowerTranscript.includes('confirm') || lowerTranscript.includes('yes')) {
        handleConfirmStatus();
        return;
      } else if (lowerTranscript.includes('say again') || lowerTranscript.includes('repeat')) {
        handleSayAgain();
        return;
      } else if (lowerTranscript.includes('cancel') || lowerTranscript.includes('no')) {
        handleCancel();
        return;
      }
    }

    // Parse order command with flexible patterns:
    // "order 1 ready", "order #1 ready", "order number 1 ready",
    // "order no 1 ready", "order no. 1 ready", "#1 ready"
    // After normalizeNumbers, spoken "order four ready" becomes "order 4 ready"
    const orderMatch = lowerTranscript.match(
      /(?:order\s*(?:#|number|no\.?)?\s*|#)(\d+)\s+(?:is\s+)?(ready|prepared|preparing|complete|completed|done|delivered|cancelled|canceled)/i
    );
    
    if (orderMatch) {
      const orderId = orderMatch[1];
      let status = orderMatch[2].toLowerCase();
      
      // Normalize status
      if (status === 'complete' || status === 'completed' || status === 'done' || status === 'prepared') {
        status = 'ready';
      }
      if (status === 'canceled') {
        status = 'cancelled';
      }

      // Find the order
      const order = orders.find(o => o.id.toString() === orderId);
      
      if (!order) {
        speak(`Order ${orderId} not found`);
        showNotification(`Order ${orderId} not found`, 'error');
        return;
      }

      // Show confirmation UI popup
      const cmd = { 
        order, 
        newStatus: status,
        originalCommand: transcript 
      };

      if (runtimeSettings.voice_confirmation_required) {
        setPendingCommand(cmd);
        setShowConfirmationUI(true);
        setWaitingForConfirmation(true);
        speak(`Did you say order ${orderId} is ${status}? Say confirm or try again.`);
      } else {
        applyOrderStatusUpdate(order, status);
      }
    } else if (lowerTranscript.length > 3) {
      // Voice heard something but couldn't parse - notify user
      showNotification(`Could not understand: "${transcript}". Say "Order [number] ready"`, 'warning');
    }
  };

  // Handle "Say Again"
  const handleSayAgain = () => {
    speak('Please repeat your command');
    setShowConfirmationUI(false);
    setPendingCommand(null);
    setWaitingForConfirmation(false);
    setLiveTranscript('');
  };

  // Handle "Confirm Status"
  const handleConfirmStatus = async () => {
    if (!pendingCommand) return;

    await applyOrderStatusUpdate(pendingCommand.order, pendingCommand.newStatus);

    setShowConfirmationUI(false);
    setPendingCommand(null);
    setWaitingForConfirmation(false);
  };

  const handleAssignDriverRetry = async (orderId) => {
    try {
      await optimizeRoute([orderId]);
      await refreshOrders();
      showNotification(`Assignment retried for order #${orderId}`, 'info');
    } catch (error) {
      console.error('Failed to retry assignment:', error);
      showNotification(`Failed to retry assignment for order #${orderId}`, 'error');
    }
  };

  // Handle Cancel
  const handleCancel = () => {
    speak('Command cancelled');
    setShowConfirmationUI(false);
    setPendingCommand(null);
    setWaitingForConfirmation(false);
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      setLiveTranscript('');
      setShowConfirmationUI(false);
      setPendingCommand(null);
      setWaitingForConfirmation(false);
    } else {
      setIsListening(true);
    }
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const pendingOrders = getPendingOrders();

  // Compute order counts by status for the stats bar
  const orderStats = {
    total: pendingOrders.length,
    preparing: pendingOrders.filter(o => o.status === 'preparing').length,
    ready: pendingOrders.filter(o => o.status === 'ready').length,
    assigned: pendingOrders.filter(o => o.status === 'assigned').length,
    outForDelivery: pendingOrders.filter(o => o.status === 'out_for_delivery').length,
    pending: pendingOrders.filter(o => o.status === 'pending').length,
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: '#F8FAFC' }}>
      {/* ─── Top Status Bar ─── */}
      <Box sx={{ 
        bgcolor: 'white', 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        px: { xs: 2, md: 4 },
        py: 1.5,
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}>
          {/* Left: Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ color: 'text.primary', letterSpacing: '-0.02em', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Mic size={22} />
              Kitchen Display
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              Hands-free order management for chefs with live voice commands
            </Typography>
            <Chip 
              label={`${orderStats.total} Active`}
              size="small"
              color="secondary"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Box>

          {/* Center: Order Stats */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {orderStats.pending > 0 && (
              <Chip label={`${orderStats.pending} Pending`} size="small" variant="outlined" color="default" />
            )}
            {orderStats.preparing > 0 && (
              <Chip label={`${orderStats.preparing} Preparing`} size="small" variant="outlined" color="warning" />
            )}
            {orderStats.ready > 0 && (
              <Chip label={`${orderStats.ready} Ready`} size="small" variant="outlined" color="success" />
            )}
            {orderStats.assigned > 0 && (
              <Chip label={`${orderStats.assigned} Assigned`} size="small" variant="outlined" color="info" />
            )}
            {orderStats.outForDelivery > 0 && (
              <Chip label={`${orderStats.outForDelivery} On Delivery`} size="small" variant="outlined" color="secondary" />
            )}
          </Box>

          {/* Right: Voice Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant={isListening ? 'contained' : 'outlined'}
              color={isListening ? 'error' : 'primary'}
              startIcon={isListening ? <Mic size={16} /> : <MicOff size={16} />}
              onClick={toggleListening}
              disabled={!isSupported}
              size="small"
              className={isListening ? 'voice-glow' : ''}
              sx={{ 
                borderRadius: 3,
                px: 2.5,
                fontWeight: 600,
                minWidth: 140,
              }}
            >
              {isListening ? 'Listening...' : 'Start Voice'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => navigate('/orders/create')}
              sx={{ borderRadius: 3, borderColor: 'divider', color: 'text.secondary' }}
            >
              New Order
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Voice Support Warning */}
      {!isSupported && (
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 2 }}>
          <Alert severity="error">
            Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
          </Alert>
        </Box>
      )}

      {/* ─── Main Content Area ─── */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>

        {/* Live Transcript Display */}
        {isListening && (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              mb: 3, 
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: 'white',
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ 
                  width: 8, height: 8, borderRadius: '50%', 
                  bgcolor: '#EF4444', 
                  animation: 'pulse 1.5s ease-in-out infinite' 
                }} />
                <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: '0.1em' }}>
                  Listening
                </Typography>
              </Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  minHeight: 36,
                  fontWeight: 500,
                  fontFamily: '"SF Mono", "Fira Code", monospace',
                  opacity: liveTranscript ? 1 : 0.5,
                }}
              >
                {liveTranscript || 'Speak a command...'}
              </Typography>
              
              {transcriptHistory.length > 0 && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 600, letterSpacing: '0.05em' }}>
                    Recent
                  </Typography>
                  {transcriptHistory.map((item, idx) => (
                    <Typography key={idx} variant="body2" sx={{ opacity: 0.4, fontSize: '0.8rem', mt: 0.25 }}>
                      {item.text}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* ─── Confirmation UI ─── */}
          {runtimeSettings.voice_confirmation_required && showConfirmationUI && pendingCommand && (
          <Paper 
            elevation={0} 
            sx={{ 
              mb: 3, 
              p: 3,
              bgcolor: '#FFFBEB',
              border: '2px solid',
              borderColor: 'warning.main',
              borderRadius: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />
              <Typography variant="overline" color="warning.dark" fontWeight={700}>
                Confirm Action
              </Typography>
            </Box>
            
            <Paper elevation={0} sx={{ bgcolor: 'white', p: 2, borderRadius: 2, mb: 2 }}>
              <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ fontFamily: 'monospace' }}>
                &quot;{pendingCommand.originalCommand}&quot;
              </Typography>
            </Paper>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Order</Typography>
                    <Typography variant="h6" fontWeight="bold">#{pendingCommand.order.id}</Typography>
                  </Box>
                  <Box sx={{ width: 1, height: 32, bgcolor: 'divider' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">New Status</Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.dark">{pendingCommand.newStatus.toUpperCase()}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleConfirmStatus}
                    fullWidth
                    size="large"
                    sx={{ borderRadius: 2 }}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                    onClick={handleSayAgain}
                    fullWidth
                    size="large"
                    sx={{ borderRadius: 2, borderColor: 'divider' }}
                  >
                    Say Again
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                  Say &quot;Confirm&quot; or &quot;Say Again&quot;
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Instructions (only when no confirmation and not listening) */}
        {!showConfirmationUI && !isListening && (
          <Alert 
            severity="info" 
            sx={{ mb: 3, borderRadius: 2 }}
            icon={false}
          >
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
              Voice Commands: Say &quot;Order [ID] [Status]&quot; — e.g. &quot;Order 5 Ready&quot;
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supported: Ready, Preparing, Delivered, Cancelled &nbsp;|&nbsp; Click &quot;Start Voice&quot; to begin
            </Typography>
          </Alert>
        )}

        {/* ─── Orders Grid — Full-Width Responsive ─── */}
        {pendingOrders.length === 0 ? (
          <Paper 
            elevation={0}
            sx={{ 
              textAlign: 'center', 
              py: 10,
              px: 4,
              borderRadius: 3,
              border: '2px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" color="text.secondary" fontWeight={600} gutterBottom>
              No active orders
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a new order to get started
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => navigate('/orders/create')}
              sx={{ borderRadius: 3 }}
            >
              Create Order
            </Button>
          </Paper>
        ) : (
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 2.5,
          }}>
            {pendingOrders.map((order) => (
              <OrderCard 
                key={order.id}
                order={order} 
                onStatusChange={(newStatus) => updateOrder(order.id, newStatus)}
                onAssignDriver={handleAssignDriverRetry}
                restaurantLocation={restaurantLocation}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ─── FAB: Voice Control ─── */}
      {isSupported && (
        <Fab
          color={isListening ? 'error' : 'secondary'}
          aria-label="toggle voice recognition"
          onClick={toggleListening}
          sx={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 64,
            height: 64,
            boxShadow: isListening 
              ? '0 0 0 4px rgba(239,68,68,0.2), 0 8px 24px rgba(239,68,68,0.3)' 
              : '0 8px 24px rgba(59,130,246,0.3)',
          }}
        >
          {isListening ? <MicIcon fontSize="large" /> : <MicOffIcon fontSize="large" />}
        </Fab>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default KitchenView;
