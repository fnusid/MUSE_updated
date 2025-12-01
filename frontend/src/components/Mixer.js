import React, { useState, useRef, useEffect } from "react";
import { extractAudioFeatures, classifyGenre, featuresToVector } from "../utils/audioFeatures";

const channels = [
  { key: "vocals", label: "🎤 Vocals", color: "text-blue-300" },
  { key: "drums", label: "🥁 Drums", color: "text-yellow-300" },
  { key: "bass", label: "🎶 Bass", color: "text-green-300" },
  { key: "other", label: "🎧 Other", color: "text-purple-300" },
];

const fmt = (db) => (db > 0 ? `+${db}` : `${db}`) + " dB";

export default function Mixer({ onSave, initialGains, autoPlay, onPlayComplete, userModel, userId, theme = "dark" }) {
  const [file, setFile] = useState(null);
  const [gains, setGains] = useState(initialGains || Object.fromEntries(channels.map((c) => [c.key, 0])));
  const [separating, setSeparating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [predictedGains, setPredictedGains] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [audioFeatures, setAudioFeatures] = useState(null);

  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const updateTimeoutRef = useRef(null);

  // Update gains when initialGains prop changes
  useEffect(() => {
    if (initialGains) {
      setGains(initialGains);
    }
  }, [initialGains]);

  // Cleanup intervals and timeouts on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Auto-play when autoPlay is true (try to play even without file - backend may have the separated tracks)
  useEffect(() => {
    if (autoPlay) {
      // Small delay to ensure gains are set
      const timer = setTimeout(() => {
        playMix();
        if (typeof onPlayComplete === "function") {
          onPlayComplete();
        }
      }, 100);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [autoPlay]);

  // ------------------------
  // Handle slider change with live updates (debounced)
  // ------------------------
  const handleChange = (key, val) => {
    const newGains = { ...gains, [key]: parseInt(val) };
    setGains(newGains);
    
    // If audio is currently playing, update it in real-time (debounced)
    if (playing && !paused && audioRef.current) {
      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Debounce the update by 200ms to avoid too many API calls (reduced for more responsive feel)
      updateTimeoutRef.current = setTimeout(() => {
        updatePlayingAudio(newGains);
      }, 200);
    }
  };

  // ------------------------
  // Update playing audio with new mix (real-time with smooth crossfade)
  // ------------------------
  const updatePlayingAudio = async (newGains) => {
    if (!audioRef.current) return;
    
    try {
      // Save current playback state
      const currentTime = audioRef.current.currentTime;
      const wasPlaying = !audioRef.current.paused;
      const oldAudio = audioRef.current;
      const oldVolume = oldAudio.volume;

      const formData = new FormData();
      formData.append("vocals_gain", newGains.vocals);
      formData.append("drums_gain", newGains.drums);
      formData.append("bass_gain", newGains.bass);
      formData.append("other_gain", newGains.other);

      const resp = await fetch("http://127.0.0.1:8000/mix", { method: "POST", body: formData });
      
      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }
      
      const data = await resp.json();

      if (!data.path) {
        throw new Error("No audio path returned from server");
      }

      // Create new audio with updated mix
      const newAudio = new Audio(`http://127.0.0.1:8000${data.path}`);
      
      // Set up event handlers
      newAudio.onended = () => {
        setPlaying(false);
        setPaused(false);
      };

      newAudio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setPlaying(false);
        setPaused(false);
      };

      // Preload the new audio
      newAudio.preload = "auto";
      newAudio.volume = 0; // Start at 0 for crossfade
      
      let crossfadeStarted = false;
      
      // Wait for audio to be ready, then do smooth crossfade
      const handleCanPlay = async () => {
        if (crossfadeStarted) return; // Prevent double execution
        crossfadeStarted = true;
        
        // Set position to match old audio
        const targetTime = Math.min(currentTime, newAudio.duration || currentTime);
        newAudio.currentTime = targetTime;
        
        if (wasPlaying) {
          try {
            // Start playing new audio at volume 0
            await newAudio.play();
            
            // Crossfade: fade out old, fade in new
            const fadeDuration = 150; // 150ms crossfade for smoother transition
            const steps = 30; // More steps for smoother fade
            const stepTime = fadeDuration / steps;
            const volumeStep = 1 / steps;
            
            let step = 0;
            const fadeInterval = setInterval(() => {
              step++;
              const newVolume = Math.min(step * volumeStep, 1);
              const oldVolumeNew = Math.max(1 - (step * volumeStep), 0);
              
              newAudio.volume = newVolume;
              if (oldAudio && oldAudio !== newAudio && !oldAudio.paused) {
                oldAudio.volume = oldVolumeNew;
              }
              
              if (step >= steps) {
                clearInterval(fadeInterval);
                // Stop old audio completely
                if (oldAudio && oldAudio !== newAudio) {
                  oldAudio.pause();
                  oldAudio.volume = oldVolume; // Restore original volume for reference
                }
                newAudio.volume = 1;
                audioRef.current = newAudio;
              }
            }, stepTime);
            
          } catch (e) {
            console.error("Error playing updated audio:", e);
            // Fallback: just swap without crossfade
            if (oldAudio) oldAudio.pause();
            audioRef.current = newAudio;
            newAudio.volume = 1;
            if (wasPlaying) newAudio.play();
          }
        } else {
          // Not playing, just swap
          if (oldAudio) oldAudio.pause();
          audioRef.current = newAudio;
          newAudio.volume = 1;
        }
      };
      
      // Use canplaythrough for better loading (waits for more data)
      newAudio.addEventListener("canplaythrough", handleCanPlay, { once: true });
      
      // Fallback: if canplaythrough doesn't fire quickly enough, use loadeddata
      const fallbackTimeout = setTimeout(() => {
        if (!crossfadeStarted && newAudio.readyState >= 2) { // HAVE_CURRENT_DATA or better
          handleCanPlay();
        }
      }, 500);
      
      newAudio.addEventListener("canplaythrough", () => {
        clearTimeout(fallbackTimeout);
      }, { once: true });
      
      // Load the audio
      newAudio.load();
      
    } catch (err) {
      console.error("Error updating audio:", err);
      // Don't show alert for real-time updates, just log the error
    }
  };

  // ------------------------
  // Poll for separation progress
  // ------------------------
  const pollProgress = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8000/separation_progress");
      if (!resp.ok) {
        console.error("Failed to fetch progress");
        return true; // Continue polling
      }
      
      const data = await resp.json();
      const progressValue = Math.round(data.progress * 100);
      setProgress(progressValue);

      if (data.status === "completed" && progressValue >= 100) {
        // Clear polling interval first
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setSeparating(false);
        setProgress(100);
        // Use setTimeout to avoid blocking
        setTimeout(() => {
          alert("Separation complete.");
        }, 100);
        return false; // Stop polling
      } else if (data.status === "error") {
        // Clear polling interval on error
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setSeparating(false);
        setTimeout(() => {
          alert("Separation error occurred.");
        }, 100);
        return false; // Stop polling
      }
      return true; // Continue polling
    } catch (err) {
      console.error("Progress poll error:", err);
      return true; // Continue polling on error
    }
  };

  // ------------------------
  // Extract features and predict settings
  // ------------------------
  const handleFileSelect = async (file) => {
    if (!file) return;
    
    setIsPredicting(true);
    try {
      // Extract audio features
      const features = await extractAudioFeatures(file);
      setAudioFeatures(features);
      
      // Classify genre
      const genreVector = classifyGenre(features);
      
      // Convert to model input
      const featureVector = featuresToVector(features, genreVector);
      
      // Predict gains if model is available
      if (userModel && userModel.isInitialized) {
        const predicted = await userModel.predict(featureVector);
        setPredictedGains(predicted);
        // Auto-apply predicted gains
        setGains(predicted);
      } else {
        setPredictedGains(null);
      }
    } catch (error) {
      console.error("Error extracting features:", error);
      setPredictedGains(null);
    } finally {
      setIsPredicting(false);
    }
  };

  // ------------------------
  // Upload and trigger Demucs
  // ------------------------
  const handleUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    
    // Extract features and predict settings
    await handleFileSelect(f);
    
    setSeparating(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", f);

    try {
      const resp = await fetch("http://127.0.0.1:8000/start_separation", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error("Separation failed");
      const data = await resp.json();

      if (data.status === "processing") {
        // Clear any existing polling interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        // Start polling for progress
        progressIntervalRef.current = setInterval(async () => {
          const shouldContinue = await pollProgress();
          if (!shouldContinue && progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }, 300); // Poll every 300ms
      } else {
        throw new Error("Unexpected response");
      }
    } catch (err) {
      console.error(err);
      alert("Error starting separation");
      setSeparating(false);
      setProgress(0);
    }
  };

  // ------------------------
  // Play / Pause / Resume / Stop
  // ------------------------
  const playMix = async () => {
    try {
      const formData = new FormData();
      formData.append("vocals_gain", gains.vocals);
      formData.append("drums_gain", gains.drums);
      formData.append("bass_gain", gains.bass);
      formData.append("other_gain", gains.other);

      const resp = await fetch("http://127.0.0.1:8000/mix", { method: "POST", body: formData });
      
      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }
      
      const data = await resp.json();

      if (!data.path) {
        throw new Error("No audio path returned from server");
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(`http://127.0.0.1:8000${data.path}`);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlaying(false);
        setPaused(false);
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        alert("Error playing audio. Make sure you have uploaded and separated a file first.");
        setPlaying(false);
        setPaused(false);
      };

      await audio.play();
      setPlaying(true);
      setPaused(false);
    } catch (err) {
      console.error("Mix playback error:", err);
      alert(`Error playing mix: ${err.message}. Make sure you have uploaded and separated a file first.`);
      setPlaying(false);
      setPaused(false);
    }
  };

  const pauseMix = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setPaused(true);
  };

  const resumeMix = () => {
    if (!audioRef.current) return;
    audioRef.current.play();
    setPaused(false);
  };

  const stopMix = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
    setPaused(false);
  };

  // ------------------------
  // Save metadata with features for model training
  // ------------------------
  const handleSave = () => {
    if (!file) {
      alert("Please upload a file first");
      return;
    }
    const title = file.name.replace(/\.[^/.]+$/, "");
    const details = channels.map((c) => `${c.label}: ${fmt(gains[c.key])}`).join(", ");
    if (typeof onSave === "function") {
      // Prepare feature vector if available
      let featureVector = null;
      if (audioFeatures) {
        const genreVector = classifyGenre(audioFeatures);
        featureVector = featuresToVector(audioFeatures, genreVector);
      }
      
      onSave({ 
        title, 
        artist: "Custom Mix", 
        details,
        gains: { ...gains }, // Save the gain settings
        features: featureVector, // Save features for model training
      });
      alert(`"${title}" saved successfully! The AI model has learned from your preferences.`);
    } else {
      alert("Error: Save handler not available");
    }
  };

  // ------------------------
  // Render UI
  // ------------------------
  const isDark = theme === "dark";
  const labelMuted = "text-muted";
  const inputText = "text-primary";
  const gainText = "text-primary";

  return (
    <div className="relative panel backdrop-blur-lg rounded-2xl p-6 shadow-lg">
      {/* AI Indicator */}
      <div className="relative z-10 mb-4 surface rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold text-blue-400">AI Music Source Separation</p>
              <p className={`text-xs ${labelMuted}`}>Separates into 4 sources: Vocals, Drums, Bass, Other</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Prediction Indicator */}
      {isPredicting && (
        <div className="relative z-10 mb-4 surface rounded-lg p-3 border border-green-500/30">
          <div className="flex items-center gap-2">
            <p className={`text-sm ${isDark ? "text-green-400" : "text-green-700"}`}>Analyzing audio and predicting your preferred settings...</p>
          </div>
        </div>
      )}

      {predictedGains && !isPredicting && userModel && (
        <div className="relative z-10 mb-4 surface rounded-lg p-3 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-semibold text-purple-400">AI Suggested Settings</p>
                <p className={`text-xs ${labelMuted}`}>
                  Based on your previous mixes: Vocals {fmt(predictedGains.vocals)}, Drums {fmt(predictedGains.drums)}, Bass {fmt(predictedGains.bass)}, Other {fmt(predictedGains.other)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setGains(predictedGains);
                setPredictedGains(null);
              }}
              className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Upload */}
      <div className="relative z-10 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <label className="text-sm font-semibold text-primary">
          Choose Audio File:
        </label>
        <input
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          className={`text-sm input-bg p-2 rounded-md ${inputText} focus:outline-none focus:ring-2 focus:ring-blue-400 transition`}
        />
        {file && <p className={`text-xs truncate max-w-[200px] ${labelMuted}`}>{file.name}</p>}
      </div>

      {/* Progress */}
      {separating && (
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${isDark ? "text-blue-400" : "text-blue-700"}`}>AI Separating Audio...</p>
            <p className={`text-xs ${labelMuted}`}>{progress}%</p>
          </div>
          <div className="w-full track rounded-md h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className={`text-xs text-center mt-1 ${labelMuted}`}>Separating into 4 sources: Vocals, Drums, Bass, Other</p>
        </div>
      )}

      {/* Sliders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 justify-items-center">
        {channels.map((ch) => (
          <div
            key={ch.key}
            className="flex flex-col items-center input-bg px-4 py-5 rounded-xl w-[140px]"
          >
            <span
              className={`text-center mb-3 font-semibold ${ch.color}`}
            >
              {ch.label}
            </span>

            {/* Slider */}
            <div className="relative h-[180px] flex items-center justify-center">
              <input
                type="range"
                min="-24"
                max="12"
                step="1"
                value={gains[ch.key]}
                onChange={(e) => handleChange(ch.key, e.target.value)}
                className={`appearance-none h-[180px] w-[6px] rounded-full cursor-pointer ${
                  isDark ? "bg-gray-700" : "bg-gray-300"
                }`}
                style={{
                  writingMode: "bt-lr",
                  WebkitAppearance: "slider-vertical",
                  appearance: "slider-vertical",
                }}
              />
            </div>

            <p className={`text-xs mt-3 tracking-wide ${gainText}`}>{fmt(gains[ch.key])}</p>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-4 mt-6 flex-wrap">
        {!playing && (
          <button
            onClick={playMix}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-md"
          >
            Play Mix
          </button>
        )}
        {playing && !paused && (
          <button
            onClick={pauseMix}
            className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-md"
          >
            Pause
          </button>
        )}
        {paused && (
          <button
            onClick={resumeMix}
            className="px-5 py-2 bg-green-400 hover:bg-green-500 text-black font-semibold rounded-md"
          >
            Resume
          </button>
        )}
        {playing && (
          <button
            onClick={stopMix}
            className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md"
          >
            Stop
          </button>
        )}
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-black font-semibold rounded-md"
        >
          Save Mix
        </button>
      </div>
    </div>
  );
}
