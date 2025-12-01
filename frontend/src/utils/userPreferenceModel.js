/**
 * User Preference Model using TensorFlow.js
 * Learns user's gain preferences based on audio features and genre
 */

import * as tf from '@tensorflow/tfjs';

export class UserPreferenceModel {
  constructor(userId) {
    this.userId = userId;
    this.model = null;
    this.inputSize = 23; // 13 audio features + 10 genre features
    this.outputSize = 4; // vocals, drums, bass, other gains
    this.isInitialized = false;
  }

  /**
   * Initialize or load the model
   */
  async initialize() {
    if (this.isInitialized) return;

    // Try to load existing model weights
    const savedWeights = this.loadWeights();
    
    if (savedWeights) {
      // Recreate model architecture
      this.createModel();
      // Load saved weights
      this.model.setWeights(savedWeights);
      console.log(`Loaded model for user: ${this.userId}`);
    } else {
      // Create new model
      this.createModel();
      console.log(`Created new model for user: ${this.userId}`);
    }
    
    this.isInitialized = true;
  }

  /**
   * Create the neural network model
   */
  createModel() {
    this.model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [this.inputSize],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
        }),
        // Hidden layer 1
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
        }),
        // Hidden layer 2
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
        }),
        // Output layer (4 gain values, normalized to -24 to 12 dB range)
        tf.layers.dense({
          units: this.outputSize,
          activation: 'tanh', // Outputs -1 to 1
          kernelInitializer: 'glorotUniform',
        }),
      ],
    });

    // Compile model with optimizer
    this.model.compile({
      optimizer: tf.train.adam(0.001), // Learning rate
      loss: 'meanSquaredError',
      // Removed metrics as meanAbsoluteError is not available in this TensorFlow.js version
    });
  }

  /**
   * Predict gain settings for given features
   */
  async predict(features) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert features to tensor
    const inputTensor = tf.tensor2d([features]);
    
    // Predict
    const prediction = this.model.predict(inputTensor);
    const values = await prediction.data();
    
    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();
    
    // Convert from -1 to 1 range to -24 to 12 dB range
    const gains = {
      vocals: Math.round(values[0] * 18 - 6), // -24 to 12, centered at -6
      drums: Math.round(values[1] * 18 - 6),
      bass: Math.round(values[2] * 18 - 6),
      other: Math.round(values[3] * 18 - 6),
    };
    
    // Clamp to valid range
    gains.vocals = Math.max(-24, Math.min(12, gains.vocals));
    gains.drums = Math.max(-24, Math.min(12, gains.drums));
    gains.bass = Math.max(-24, Math.min(12, gains.bass));
    gains.other = Math.max(-24, Math.min(12, gains.other));
    
    return gains;
  }

  /**
   * Train the model with a new example (online learning)
   */
  async train(features, actualGains) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert gains from dB range (-24 to 12) to -1 to 1 range
    const normalizedGains = [
      (actualGains.vocals + 6) / 18, // Normalize to -1 to 1
      (actualGains.drums + 6) / 18,
      (actualGains.bass + 6) / 18,
      (actualGains.other + 6) / 18,
    ];

    // Prepare training data
    const inputTensor = tf.tensor2d([features]);
    const outputTensor = tf.tensor2d([normalizedGains]);

    // Train for a few epochs (online learning - single example)
    await this.model.fit(inputTensor, outputTensor, {
      epochs: 5,
      batchSize: 1,
      verbose: 0, // Don't log training progress
    });

    // Clean up tensors
    inputTensor.dispose();
    outputTensor.dispose();

    // Save updated weights
    this.saveWeights();

    console.log(`Model trained with new example for user: ${this.userId}`);
  }

  /**
   * Batch train the model with all songs (retrain from scratch)
   */
  async batchTrain(songs) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Filter songs that have features and gains
    const validSongs = songs.filter(song => song.features && song.gains);
    
    if (validSongs.length === 0) {
      console.log(`No valid training data for user: ${this.userId}`);
      return;
    }

    // Prepare all training data
    const featuresList = [];
    const gainsList = [];

    for (const song of validSongs) {
      featuresList.push(song.features);
      
      // Convert gains from dB range (-24 to 12) to -1 to 1 range
      gainsList.push([
        (song.gains.vocals + 6) / 18,
        (song.gains.drums + 6) / 18,
        (song.gains.bass + 6) / 18,
        (song.gains.other + 6) / 18,
      ]);
    }

    // Create tensors
    const inputTensor = tf.tensor2d(featuresList);
    const outputTensor = tf.tensor2d(gainsList);

    // Train on all data
    await this.model.fit(inputTensor, outputTensor, {
      epochs: 10, // More epochs for batch training
      batchSize: Math.min(validSongs.length, 8), // Batch size based on data
      verbose: 0,
    });

    // Clean up tensors
    inputTensor.dispose();
    outputTensor.dispose();

    // Save updated weights
    this.saveWeights();

    console.log(`Model batch trained with ${validSongs.length} examples for user: ${this.userId}`);
  }

  /**
   * Save model weights to localStorage
   */
  saveWeights() {
    if (!this.model) return;

    try {
      const weights = this.model.getWeights();
      const weightData = weights.map(weight => {
        return {
          shape: weight.shape,
          data: Array.from(weight.dataSync()),
        };
      });

      const key = `userModel_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(weightData));
    } catch (error) {
      console.error('Error saving model weights:', error);
    }
  }

  /**
   * Load model weights from localStorage
   */
  loadWeights() {
    try {
      const key = `userModel_${this.userId}`;
      const saved = localStorage.getItem(key);
      
      if (!saved) return null;

      const weightData = JSON.parse(saved);
      return weightData.map(w => tf.tensor(w.data, w.shape));
    } catch (error) {
      console.error('Error loading model weights:', error);
      return null;
    }
  }

  /**
   * Get model statistics
   */
  getStats() {
    const key = `userModel_${this.userId}`;
    const saved = localStorage.getItem(key);
    return {
      exists: saved !== null,
      userId: this.userId,
      isInitialized: this.isInitialized,
    };
  }
}
