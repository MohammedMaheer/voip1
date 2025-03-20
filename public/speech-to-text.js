// Add this to your index.js or create a new file called speech-to-text.js

// Configuration for the WebSpeech API
const speechConfig = {
  continuous: true,
  interimResults: true,
  lang: 'en-US' // Change to desired language
};

// Performance tracking class
class PerformanceTracker {
  constructor() {
    this.callStartTime = null;
    this.callDurations = [];
    this.transcripts = [];
    this.recognitionSuccessRate = [];
    this.packetsReceived = 0;
    this.packetsSent = 0;
    this.packetLoss = [];
    this.recognitionLatency = [];
  }

  startCall() {
    this.callStartTime = Date.now();
    this.packetsReceived = 0;
    this.packetsSent = 0;
  }

  endCall() {
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime) / 1000; // in seconds
      this.callDurations.push(duration);
      
      // Calculate packet loss if any packets were sent
      if (this.packetsSent > 0) {
        const lossRate = (this.packetsSent - this.packetsReceived) / this.packetsSent;
        this.packetLoss.push(lossRate);
      }
      
      this.callStartTime = null;
    }
  }

  packetSent() {
    this.packetsSent++;
  }

  packetReceived() {
    this.packetsReceived++;
  }

  addTranscript(text, success) {
    if (text) {
      this.transcripts.push({
        text,
        timestamp: new Date().toISOString()
      });
      this.recognitionSuccessRate.push(success ? 1 : 0);
    }
  }

  recordLatency(latencyMs) {
    this.recognitionLatency.push(latencyMs);
  }

  generateReport() {
    if (this.callDurations.length === 0) {
      return "No call data available for performance analysis.";
    }

    // Calculate metrics
    const avgDuration = this.callDurations.reduce((a, b) => a + b, 0) / this.callDurations.length;
    
    let avgPacketLoss = 0;
    if (this.packetLoss.length > 0) {
      avgPacketLoss = this.packetLoss.reduce((a, b) => a + b, 0) / this.packetLoss.length;
    }
    
    let recognitionSuccessRate = 0;
    if (this.recognitionSuccessRate.length > 0) {
      recognitionSuccessRate = this.recognitionSuccessRate.reduce((a, b) => a + b, 0) / this.recognitionSuccessRate.length;
    }
    
    let avgLatency = 0;
    if (this.recognitionLatency.length > 0) {
      avgLatency = this.recognitionLatency.reduce((a, b) => a + b, 0) / this.recognitionLatency.length;
    }
    
    // Calculate confidence scores
    const packetConfidence = Math.max(0, Math.min(100, 100 - (avgPacketLoss * 200))); // 0% loss = 100 confidence, 50% loss = 0 confidence
    const recognitionConfidence = recognitionSuccessRate * 100;
    const latencyConfidence = Math.max(0, Math.min(100, 100 - (avgLatency / 100))); // 0ms = 100 confidence, 10000ms = 0 confidence
    
    const overallConfidence = (packetConfidence * 0.4) + (recognitionConfidence * 0.4) + (latencyConfidence * 0.2);
    
    // Recent transcripts
    const recentTranscripts = this.transcripts.slice(-5);
    
    // Quality rating
    let qualityRating = "Poor";
    if (overallConfidence > 90) qualityRating = "Excellent";
    else if (overallConfidence > 75) qualityRating = "Good";
    else if (overallConfidence > 50) qualityRating = "Fair";
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {
        callCount: this.callDurations.length,
        averageCallDurationSeconds: Math.round(avgDuration * 100) / 100,
        averagePacketLossPercentage: Math.round(avgPacketLoss * 10000) / 100,
        speechRecognitionSuccessRate: Math.round(recognitionSuccessRate * 10000) / 100,
        averageRecognitionLatencyMs: Math.round(avgLatency * 100) / 100,
        transcriptsCollected: this.transcripts.length
      },
      confidence: {
        networkQuality: Math.round(packetConfidence * 100) / 100,
        speechRecognitionQuality: Math.round(recognitionConfidence * 100) / 100,
        latencyPerformance: Math.round(latencyConfidence * 100) / 100,
        overallSystemConfidence: Math.round(overallConfidence * 100) / 100
      },
      transcriptSamples: recentTranscripts
    };
    
    // Generate textual summary
    let networkAssessment = "Network quality issues detected - high packet loss affecting call quality.";
    if (packetConfidence > 90) networkAssessment = "Network quality is excellent with minimal packet loss.";
    else if (packetConfidence > 70) networkAssessment = "Network quality is acceptable but shows some packet loss.";
    
    let recognitionAssessment = "Speech recognition is underperforming and requires attention.";
    if (recognitionConfidence > 75) recognitionAssessment = "Speech recognition is performing well with acceptable latency and high accuracy.";
    else if (recognitionConfidence > 50) recognitionAssessment = "Speech recognition shows moderate performance but could be improved.";
    
    const summary = `
VOIP PERFORMANCE REPORT WITH SPEECH-TO-TEXT ANALYSIS

Overall System Confidence: ${report.confidence.overallSystemConfidence}% (${qualityRating})

Call Statistics:
- Total calls: ${report.metrics.callCount}
- Average duration: ${report.metrics.averageCallDurationSeconds} seconds
- Packet loss: ${report.metrics.averagePacketLossPercentage}%
- Network quality confidence: ${report.confidence.networkQuality}%

Speech Recognition:
- Success rate: ${report.metrics.speechRecognitionSuccessRate}%
- Average latency: ${report.metrics.averageRecognitionLatencyMs} ms
- Total transcripts: ${report.metrics.transcriptsCollected}
- Recognition quality confidence: ${report.confidence.speechRecognitionQuality}%

System Assessment:
The VoIP system with speech-to-text integration is currently ${qualityRating.toLowerCase()}.
${recognitionAssessment}
${networkAssessment}

Recent Transcripts:
${recentTranscripts.map(t => `- "${t.text}"`).join('\n')}
`;
    
    return { summary, report };
  }
}

// Initialize performance tracker
const performanceTracker = new PerformanceTracker();

// Setup Speech Recognition
class SpeechToTextManager {
  constructor() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }
    
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.continuous = speechConfig.continuous;
    this.recognition.interimResults = speechConfig.interimResults;
    this.recognition.lang = speechConfig.lang;
    
    this.isListening = false;
    this.transcriptContainer = null;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.updateStatus('Listening...');
    };
    
    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      this.updateStatus('Not listening');
      
      // Restart if we still want to be listening
      if (this.shouldBeListening) {
        this.recognition.start();
      }
    };
    
    this.recognition.onresult = (event) => {
      const startTime = performance.now();
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          const latency = performance.now() - startTime;
          performanceTracker.recordLatency(latency);
          performanceTracker.addTranscript(transcript, true);
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        console.log('Final transcript:', finalTranscript);
        this.updateTranscript(finalTranscript, true);
      }
      
      if (interimTranscript) {
        console.log('Interim transcript:', interimTranscript);
        this.updateTranscript(interimTranscript, false);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      performanceTracker.addTranscript("", false);
      this.updateStatus(`Error: ${event.error}`);
    };
  }
  
  start() {
    if (!this.recognition) return;
    
    try {
      this.shouldBeListening = true;
      this.recognition.start();
      console.log('Started speech recognition');
    } catch (e) {
      console.error('Error starting speech recognition:', e);
    }
  }
  
  stop() {
    if (!this.recognition) return;
    
    try {
      this.shouldBeListening = false;
      this.recognition.stop();
      console.log('Stopped speech recognition');
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }
  }
  
  setTranscriptContainer(element) {
    this.transcriptContainer = element;
  }
  
  updateTranscript(text, isFinal) {
    if (!this.transcriptContainer) return;
    
    // Create or update transcript element
    if (isFinal) {
      const transcriptElement = document.createElement('p');
      transcriptElement.classList.add('final-transcript');
      transcriptElement.textContent = text;
      this.transcriptContainer.appendChild(transcriptElement);
      
      // Keep only the latest transcripts (e.g., last 10)
      const maxTranscripts = 10;
      const transcripts = this.transcriptContainer.querySelectorAll('.final-transcript');
      if (transcripts.length > maxTranscripts) {
        for (let i = 0; i < transcripts.length - maxTranscripts; i++) {
          this.transcriptContainer.removeChild(transcripts[i]);
        }
      }
    } else {
      let interimElement = this.transcriptContainer.querySelector('.interim-transcript');
      if (!interimElement) {
        interimElement = document.createElement('p');
        interimElement.classList.add('interim-transcript');
        this.transcriptContainer.appendChild(interimElement);
      }
      interimElement.textContent = text;
    }
  }
  
  updateStatus(status) {
    const statusElement = document.getElementById('stt-status');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }
}

// Function to update WebRTC to use our performance tracker and speech recognition
function enhanceVoipWithSpeechToText() {
  // Create UI elements for speech-to-text
  const createSpeechToTextUI = () => {
    // Create container for transcript
    const container = document.createElement('div');
    container.id = 'transcript-container';
    container.style.cssText = 'margin-top: 20px; border: 1px solid #ccc; padding: 10px; height: 200px; overflow-y: auto;';
    
    // Create status element
    const status = document.createElement('div');
    status.id = 'stt-status';
    status.textContent = 'Not listening';
    status.style.cssText = 'margin-bottom: 10px; font-style: italic;';
    
    // Create heading
    const heading = document.createElement('h3');
    heading.textContent = 'Live Transcription';
    
    // Append elements
    container.appendChild(status);
    
    // Insert into document
    const controlsContainer = document.querySelector('.controls-container') || document.body;
    controlsContainer.appendChild(heading);
    controlsContainer.appendChild(container);
    
    return container;
  };
  
  // Initialize speech recognition
  const transcriptContainer = createSpeechToTextUI();
  const speechToText = new SpeechToTextManager();
  speechToText.setTranscriptContainer(transcriptContainer);
  
  // Create UI for performance report
  const createPerformanceReportUI = () => {
    const container = document.createElement('div');
    container.id = 'performance-report-container';
    container.style.cssText = 'margin-top: 20px;';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Performance Report';
    
    const reportButton = document.createElement('button');
    reportButton.textContent = 'Generate Report';
    reportButton.style.cssText = 'margin-bottom: 10px; padding: 5px 10px;';
    reportButton.onclick = () => {
      const { summary } = performanceTracker.generateReport();
      reportContent.innerHTML = `<pre>${summary}</pre>`;
    };
    
    const reportContent = document.createElement('div');
    reportContent.id = 'report-content';
    reportContent.style.cssText = 'border: 1px solid #ccc; padding: 10px; max-height: 300px; overflow-y: auto;';
    
    container.appendChild(heading);
    container.appendChild(reportButton);
    container.appendChild(reportContent);
    
    const controlsContainer = document.querySelector('.controls-container') || document.body;
    controlsContainer.appendChild(container);
  };
  
  createPerformanceReportUI();
  
  // Hook into existing WebRTC code to track performance
  // These functions need to be integrated with your existing WebRTC implementation
  
  // Patch the RTCPeerConnection to monitor packets
  const originalAddTrack = RTCPeerConnection.prototype.addTrack;
  RTCPeerConnection.prototype.addTrack = function(...args) {
    const sender = originalAddTrack.apply(this, args);
    
    // Monitor outgoing packets
    const originalSendFunction = sender.send;
    sender.send = function(frame) {
      performanceTracker.packetSent();
      return originalSendFunction.call(this, frame);
    };
    
    return sender;
  };
  
  // Patch ontrack to monitor incoming packets
  const originalSetOntrack = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ontrack');
  Object.defineProperty(RTCPeerConnection.prototype, 'ontrack', {
    set(handler) {
      if (handler) {
        const wrappedHandler = function(event) {
          // Monitor received packets
          event.track.onreceive = function() {
            performanceTracker.packetReceived();
          };
          return handler.apply(this, arguments);
        };
        originalSetOntrack.set.call(this, wrappedHandler);
      } else {
        originalSetOntrack.set.call(this, null);
      }
    },
    get: originalSetOntrack.get
  });
  
  // Hook into call start and end
  // Assuming you have functions like this in your code:
  const originalStartCall = window.startCall;
  window.startCall = function(...args) {
    performanceTracker.startCall();
    speechToText.start();
    return originalStartCall.apply(this, args);
  };
  
  const originalEndCall = window.endCall;
  window.endCall = function(...args) {
    performanceTracker.endCall();
    speechToText.stop();
    return originalEndCall.apply(this, args);
  };
  
  // Add buttons to your UI
  const addControlButtons = () => {
    const container = document.querySelector('.controls-container') || document.body;
    
    // Start STT button
    const startSTTButton = document.createElement('button');
    startSTTButton.textContent = 'Start Transcription';
    startSTTButton.style.cssText = 'margin: 5px; padding: 5px 10px;';
    startSTTButton.onclick = () => speechToText.start();
    
    // Stop STT button
    const stopSTTButton = document.createElement('button');
    stopSTTButton.textContent = 'Stop Transcription';
    stopSTTButton.style.cssText = 'margin: 5px; padding: 5px 10px;';
    stopSTTButton.onclick = () => speechToText.stop();
    
    container.appendChild(startSTTButton);
    container.appendChild(stopSTTButton);
  };
  
  addControlButtons();
  
  console.log('VoIP enhanced with Speech-to-Text capabilities');
}

// Call this function after your WebRTC implementation is initialized
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure the WebRTC implementation is fully loaded
  setTimeout(enhanceVoipWithSpeechToText, 1000);
});
