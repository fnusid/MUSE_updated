/**
 * Extract audio features from an audio file using Web Audio API
 * Returns features that can be used for genre classification and preference learning
 */

export async function extractAudioFeatures(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Extract features
        const features = {
          // Basic features
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          
          // Energy and dynamics
          rms: calculateRMS(audioBuffer),
          zeroCrossingRate: calculateZeroCrossingRate(audioBuffer),
          
          // Spectral features
          spectralCentroid: calculateSpectralCentroid(audioBuffer, audioContext),
          spectralRolloff: calculateSpectralRolloff(audioBuffer, audioContext),
          spectralFlux: calculateSpectralFlux(audioBuffer, audioContext),
          
          // Temporal features
          tempo: estimateTempo(audioBuffer),
          
          // MFCC-like features (simplified)
          mfcc: calculateSimpleMFCC(audioBuffer, audioContext),
        };
        
        // Normalize features
        const normalizedFeatures = normalizeFeatures(features);
        
        resolve(normalizedFeatures);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function calculateRMS(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  return Math.sqrt(sum / channelData.length);
}

function calculateZeroCrossingRate(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / channelData.length;
}

function calculateSpectralCentroid(audioBuffer, audioContext) {
  const fftSize = 2048;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  
  // Get frequency data (simplified - using first channel)
  const channelData = audioBuffer.getChannelData(0);
  const samples = Math.min(channelData.length, fftSize);
  
  // Simple FFT approximation using windowed samples
  let centroid = 0;
  let magnitudeSum = 0;
  
  for (let i = 0; i < samples; i++) {
    const freq = (i * audioContext.sampleRate) / (2 * fftSize);
    const magnitude = Math.abs(channelData[i]);
    centroid += freq * magnitude;
    magnitudeSum += magnitude;
  }
  
  return magnitudeSum > 0 ? centroid / magnitudeSum : 0;
}

function calculateSpectralRolloff(audioBuffer, audioContext) {
  const fftSize = 2048;
  const channelData = audioBuffer.getChannelData(0);
  const samples = Math.min(channelData.length, fftSize);
  
  let totalEnergy = 0;
  for (let i = 0; i < samples; i++) {
    totalEnergy += Math.abs(channelData[i]);
  }
  
  const threshold = 0.85 * totalEnergy;
  let cumulativeEnergy = 0;
  
  for (let i = 0; i < samples; i++) {
    cumulativeEnergy += Math.abs(channelData[i]);
    if (cumulativeEnergy >= threshold) {
      return (i * audioContext.sampleRate) / (2 * fftSize);
    }
  }
  
  return (audioContext.sampleRate / 2) * 0.85;
}

function calculateSpectralFlux(audioBuffer, audioContext) {
  const channelData = audioBuffer.getChannelData(0);
  const windowSize = 1024;
  let flux = 0;
  
  for (let i = windowSize; i < channelData.length; i += windowSize) {
    const prev = Math.abs(channelData[i - windowSize]);
    const curr = Math.abs(channelData[i]);
    flux += Math.max(0, curr - prev);
  }
  
  return flux / Math.floor(channelData.length / windowSize);
}

function estimateTempo(audioBuffer) {
  // Simple tempo estimation based on energy peaks
  const channelData = audioBuffer.getChannelData(0);
  const windowSize = 4096;
  const energies = [];
  
  for (let i = 0; i < channelData.length; i += windowSize) {
    let energy = 0;
    for (let j = i; j < Math.min(i + windowSize, channelData.length); j++) {
      energy += channelData[j] * channelData[j];
    }
    energies.push(energy);
  }
  
  // Find peaks (simplified)
  let peaks = 0;
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks++;
    }
  }
  
  const duration = audioBuffer.duration;
  const bpm = (peaks / duration) * 60;
  
  // Normalize to reasonable range (60-180 BPM)
  return Math.max(60, Math.min(180, bpm));
}

function calculateSimpleMFCC(audioBuffer, audioContext) {
  // Simplified MFCC calculation (first 5 coefficients)
  const channelData = audioBuffer.getChannelData(0);
  const mfcc = [];
  
  // Use simple frequency bands
  const numBands = 5;
  const bandSize = Math.floor(channelData.length / numBands);
  
  for (let band = 0; band < numBands; band++) {
    let energy = 0;
    const start = band * bandSize;
    const end = Math.min(start + bandSize, channelData.length);
    
    for (let i = start; i < end; i++) {
      energy += Math.abs(channelData[i]);
    }
    
    // Log energy (MFCC-like)
    mfcc.push(Math.log(1 + energy / bandSize));
  }
  
  return mfcc;
}

function normalizeFeatures(features) {
  // Normalize features to 0-1 range for better model training
  return {
    duration: Math.min(features.duration / 300, 1), // Max 5 minutes
    sampleRate: features.sampleRate / 48000, // Normalize by max common sample rate
    rms: Math.min(features.rms * 10, 1), // RMS typically 0-0.1
    zeroCrossingRate: Math.min(features.zeroCrossingRate * 100, 1),
    spectralCentroid: Math.min(features.spectralCentroid / 10000, 1), // Max 10kHz
    spectralRolloff: Math.min(features.spectralRolloff / 10000, 1),
    spectralFlux: Math.min(features.spectralFlux * 100, 1),
    tempo: (features.tempo - 60) / 120, // Normalize 60-180 BPM to 0-1
    mfcc0: features.mfcc[0] / 10,
    mfcc1: features.mfcc[1] / 10,
    mfcc2: features.mfcc[2] / 10,
    mfcc3: features.mfcc[3] / 10,
    mfcc4: features.mfcc[4] / 10,
  };
}

/**
 * Simple genre classification based on features
 * Returns a genre vector (one-hot encoding)
 */
export function classifyGenre(features) {
  // Simple rule-based genre classification
  // In production, this could be a trained model
  const genres = ['pop', 'rock', 'electronic', 'hiphop', 'jazz', 'classical', 'country', 'metal', 'reggae', 'blues'];
  const genreVector = new Array(genres.length).fill(0);
  
  // Simple heuristics
  if (features.tempo > 0.6 && features.spectralCentroid > 0.5) {
    genreVector[0] = 0.8; // pop
  } else if (features.tempo > 0.5 && features.rms > 0.7) {
    genreVector[1] = 0.8; // rock
  } else if (features.spectralCentroid > 0.6 && features.spectralFlux > 0.5) {
    genreVector[2] = 0.8; // electronic
  } else if (features.tempo > 0.55 && features.zeroCrossingRate > 0.4) {
    genreVector[3] = 0.8; // hiphop
  } else {
    genreVector[0] = 0.3; // default to pop with low confidence
  }
  
  return genreVector;
}

/**
 * Convert features to model input vector
 */
export function featuresToVector(features, genreVector) {
  return [
    features.duration,
    features.sampleRate,
    features.rms,
    features.zeroCrossingRate,
    features.spectralCentroid,
    features.spectralRolloff,
    features.spectralFlux,
    features.tempo,
    features.mfcc0,
    features.mfcc1,
    features.mfcc2,
    features.mfcc3,
    features.mfcc4,
    ...genreVector, // 10 genre features
  ]; // Total: 23 features
}

