import React from 'react';
import { Box, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';

/**
 * Voice Indicator Component
 * Shows visual feedback when system is listening
 */
const VoiceIndicator = ({ isListening }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 1.5,
        borderRadius: 2,
        bgcolor: isListening ? 'secondary.main' : 'grey.300',
        color: isListening ? 'white' : 'text.secondary',
        transition: 'all 0.3s ease',
      }}
    >
      <MicIcon 
        sx={{ 
          fontSize: 32,
        }}
        className={isListening ? 'listening-pulse' : ''}
      />
      <Typography variant="h6" fontWeight="medium">
        {isListening ? 'Listening...' : 'Not Listening'}
      </Typography>
    </Box>
  );
};

export default VoiceIndicator;
