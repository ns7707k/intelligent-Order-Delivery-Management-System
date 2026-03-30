/**
 * Voice Recognition Service using Web Speech API
 * Handles voice commands for the Kitchen Display System
 */

class VoiceRecognitionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.confidenceThreshold = 0.8;
    this.synthesis = window.speechSynthesis;
    
    // Check browser support
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      this.recognition = new SpeechRecognition();
    } else {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  /**
   * Start listening for voice commands
   * @param {Function} onResult - Callback when voice is recognized
   * @param {Function} onError - Callback when error occurs
   * @param {Function} onStateChange - Callback when listening state changes
   */
  startListening(onResult, onError, onStateChange) {
    if (!this.recognition) {
      onError(new Error('Speech recognition not supported'));
      return;
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      if (onStateChange) onStateChange(true);
      console.log('Voice recognition started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onStateChange) onStateChange(false);
      console.log('Voice recognition ended');
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      console.log(`Recognized: "${transcript}" (confidence: ${confidence})`);

      // Parse command: [System] + [Order ID] + [Status]
      const command = this.parseCommand(transcript);
      
      if (command) {
        onResult({
          ...command,
          confidence,
          transcript,
          meetsThreshold: confidence >= this.confidenceThreshold,
        });
      } else {
        onError(new Error('Invalid command format'));
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      onError(event);
    };

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      onError(error);
    }
  }

  /**
   * Stop listening for voice commands
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Parse voice command to extract order ID and status
   * Expected format: "system order [ID] [status]"
   * Example: "system order 123 ready" or "order 456 ready"
   */
  parseCommand(transcript) {
    const text = transcript.toLowerCase();
    
    // Pattern matching for commands
    // Matches: "system order 123 ready", "order 123 ready", "mark order 123 as ready"
    const patterns = [
      /(?:system\s+)?order\s+(\d+)\s+(ready|preparing|delivered|cancelled)/i,
      /(?:mark\s+)?order\s+(\d+)\s+(?:as\s+)?(ready|preparing|delivered|cancelled)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          orderId: match[1],
          status: match[2].toLowerCase(),
        };
      }
    }

    return null;
  }

  /**
   * Speak text using Speech Synthesis API
   * @param {string} text - Text to speak
   */
  speak(text) {
    if (this.synthesis) {
      // Cancel any ongoing speech
      this.synthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      this.synthesis.speak(utterance);
    }
  }

  /**
   * Check if browser supports Web Speech API
   */
  static isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Get current listening state
   */
  getListeningState() {
    return this.isListening;
  }

  /**
   * Set confidence threshold (0.0 to 1.0)
   */
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }
}

export default VoiceRecognitionService;
