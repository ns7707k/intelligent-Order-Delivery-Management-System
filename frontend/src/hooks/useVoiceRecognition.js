import { useState, useEffect, useCallback, useRef } from 'react';
import VoiceRecognitionService from '../services/voiceRecognition';

/**
 * Custom hook for voice recognition
 * Manages voice command listening and processing
 */
export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastCommand, setLastCommand] = useState(null);
  const [error, setError] = useState(null);
  
  const serviceRef = useRef(null);

  useEffect(() => {
    // Initialize voice recognition service
    serviceRef.current = new VoiceRecognitionService();
    setIsSupported(VoiceRecognitionService.isSupported());

    return () => {
      // Cleanup: stop listening on unmount
      if (serviceRef.current) {
        serviceRef.current.stopListening();
      }
    };
  }, []);

  const startListening = useCallback((onCommand) => {
    if (!serviceRef.current) return;

    const handleResult = (result) => {
      setLastCommand(result);
      if (onCommand) {
        onCommand(result);
      }
    };

    const handleError = (err) => {
      console.error('Voice recognition error:', err);
      setError(err.message || 'Voice recognition error');
      setIsListening(false);
    };

    const handleStateChange = (listening) => {
      setIsListening(listening);
    };

    serviceRef.current.startListening(
      handleResult,
      handleError,
      handleStateChange
    );
  }, []);

  const stopListening = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.stopListening();
    }
  }, []);

  const speak = useCallback((text) => {
    if (serviceRef.current) {
      serviceRef.current.speak(text);
    }
  }, []);

  return {
    isListening,
    isSupported,
    lastCommand,
    error,
    startListening,
    stopListening,
    speak,
  };
};

export default useVoiceRecognition;
