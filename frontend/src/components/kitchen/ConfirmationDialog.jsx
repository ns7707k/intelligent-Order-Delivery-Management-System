import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { CheckCircle } from 'lucide-react';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';

/**
 * Confirmation Dialog Component
 * High-contrast overlay for confirming voice commands
 */
const ConfirmationDialog = ({ open, command, onConfirm }) => {
  const [countdown, setCountdown] = useState(10);
  const { speak } = useVoiceRecognition();

  useEffect(() => {
    if (open) {
      setCountdown(10);
      
      // Auto-cancel after 10 seconds
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onConfirm(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm(true);
  };

  const handleCancel = () => {
    onConfirm(false);
  };

  if (!command) return null;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          boxShadow: 24,
        },
      }}
      BackdropProps={{
        className: 'confirmation-overlay',
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <CheckCircle size={64} style={{ color: 'var(--mui-palette-warning-main)', marginBottom: 16 }} />
        <Typography variant="h4" component="div" fontWeight="bold">
          Confirm Order Update
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Voice confirmation required for status change
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center', py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Order #{command.order.id}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Change status to:
          </Typography>
          <Chip 
            label={command.newStatus.toUpperCase()}
            color="primary"
            sx={{ 
              mt: 2, 
              fontSize: '1.1rem',
              height: 40,
              px: 2,
            }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary">
          Say "Confirm" or click the button below
        </Typography>
        
        <Typography variant="caption" display="block" sx={{ mt: 2 }} color="warning.main">
          Auto-cancelling in {countdown} seconds
        </Typography>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', pb: 4, gap: 2 }}>
        <Button
          onClick={handleCancel}
          variant="outlined"
          size="large"
          color="error"
          sx={{ minWidth: 120 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          size="large"
          color="primary"
          sx={{ minWidth: 120 }}
          autoFocus
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
