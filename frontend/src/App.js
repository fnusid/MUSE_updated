// import React, { useState } from "react";
// import Landing from "./components/Landing";
// import Mixer from "./components/Mixer";
// import SongList from "./components/SongList";
// import HelpModal from "./components/HelpModal";
// import AboutModal from "./components/AboutModal";

// export default function App() {
//   const [user, setUser] = useState(null);
//   const [showHelp, setShowHelp] = useState(false);
//   const [showAbout, setShowAbout] = useState(false);
//   const [songsByUser, setSongsByUser] = useState({}); // { user: [{title, artist, details}] }

//   const handleSaveMix = (mix) => {
//     setSongsByUser((prev) => {
//       const list = prev[user] || [];
//       const duplicate = list.some(
//         (s) => s.title === mix.title && s.details === mix.details
//       );
//       if (duplicate) return prev;
//       return { ...prev, [user]: [...list, mix] };
//     });
//   };

//   if (!user) {
//     return <Landing onSelect={setUser} />;
//   }

//   const songs = songsByUser[user] || [];

//   return (
//     <div className="max-w-6xl mx-auto text-white p-6">
//       <div className="flex justify-between items-center mb-4">
//         <h2 className="text-2xl font-semibold">{user}'s Dashboard</h2>
//         <div className="flex gap-4 items-center">
//           <button onClick={() => setShowHelp(true)} title="Help">❔</button>
//           <button onClick={() => setShowAbout(true)} title="About">ℹ️</button>
//           <button onClick={() => setUser(null)} className="text-blue-400">← Back</button>
//         </div>
//       </div>

//       <Mixer onSave={handleSaveMix} />

//       <SongList songs={songs} />

//       {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
//       {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

//       <footer className="text-center text-sm text-gray-400 mt-8">
//         Human–Audio Interaction Prototype © 2025 · Interactive Music Perception & Co-Creation Study
//       </footer>
//     </div>
//   );
// }

import React, { useState, useEffect, useRef } from "react";
import Mixer from "./components/Mixer";
import MySongs from "./components/MySongs";
import AboutModal from "./components/AboutModal";
import HelpModal from "./components/HelpModal";
import Landing from "./components/Landing";
import { UserPreferenceModel } from "./utils/userPreferenceModel";

export default function App() {
  const [user, setUser] = useState(null); // current user
  const [tab, setTab] = useState("landing");
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("museTheme");
    return stored === "light" ? "light" : "dark";
  });
  const isDark = theme === "dark";
  
  // Load songs from localStorage on mount
  const [songsByUser, setSongsByUser] = useState(() => {
    const stored = localStorage.getItem("audioMixSongs");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing stored songs:", e);
      }
    }
    return {}; // { username: [songs] }
  });
  
  const [mixerGains, setMixerGains] = useState(null); // Gains to restore in mixer
  const [autoPlayMix, setAutoPlayMix] = useState(false); // Auto-play flag
  const userModelRef = useRef(null); // User preference model

  // Initialize user model when user changes
  useEffect(() => {
    if (user) {
      userModelRef.current = new UserPreferenceModel(user);
      userModelRef.current.initialize();
    }
  }, [user]);

  // Sync theme to body class and localStorage
  useEffect(() => {
    document.body.classList.remove("theme-dark", "theme-light");
    document.body.classList.add(theme === "light" ? "theme-light" : "theme-dark");
    localStorage.setItem("museTheme", theme);
  }, [theme]);

  // Save songs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("audioMixSongs", JSON.stringify(songsByUser));
  }, [songsByUser]);

  // Save mix per user and train model
  const handleSaveMix = async (mix) => {
    if (!user) return alert("Select a user first!");
    
    // Train the model with the saved mix (if features are available)
    if (userModelRef.current && mix.features && mix.gains) {
      try {
        await userModelRef.current.train(mix.features, mix.gains);
        console.log("Model trained with saved mix");
      } catch (error) {
        console.error("Error training model:", error);
      }
    }
    
    setSongsByUser((prev) => {
      const list = prev[user] || [];
      const duplicate = list.some(
        (s) => s.title === mix.title && s.details === mix.details
      );
      if (duplicate) return prev;
      return { ...prev, [user]: [...list, mix] };
    });
    setTab("mysongs");
  };

  // Song play (from MySongs)
  const handleSongSelect = async (song) => {
    console.log("Selected song:", song.title);
    
    // Restore the saved gain settings
    if (song.gains) {
      setMixerGains(song.gains);
      setTab("mixer");
      // Set auto-play flag - will trigger after component mounts
      setAutoPlayMix(true);
    } else {
      alert(`Cannot play "${song.title}": Gain settings not found. This song may have been saved before the update.`);
    }
  };

  // Delete song from user's list and retrain model
  const handleDeleteSong = async (songIndex) => {
    if (!user) return;
    
    setSongsByUser((prev) => {
      const userSongs = prev[user] || [];
      const updatedSongs = userSongs.filter((_, idx) => idx !== songIndex);
      
      // Retrain model with remaining songs after deletion
      if (userModelRef.current && userModelRef.current.isInitialized) {
        if (updatedSongs.length > 0) {
          // Retrain with all remaining songs
          userModelRef.current.batchTrain(updatedSongs).catch(error => {
            console.error("Error retraining model after deletion:", error);
          });
        } else {
          // If no songs left, reset model to initial state
          console.log("No songs remaining, model will use default predictions");
        }
      }
      
      return { ...prev, [user]: updatedSongs };
    });
  };

  // If no user selected, show Landing
  if (!user) {
    return (
      <Landing
        onSelectUser={(selectedUser) => {
          console.log("User selected:", selectedUser);
          setUser(selectedUser);
          setTab("mixer");
        }}
      />
    );
  }

  const songs = songsByUser[user] || [];

  // Main UI after user is logged in
  return (
    <div className="min-h-screen p-6 transition-colors duration-200 text-primary">
      <h1 className="text-2xl font-semibold mb-2 text-center">{user}'s Dashboard</h1>
      <p className="text-center text-sm text-blue-400 mb-6">
        Powered by AI Music Source Separation - 4 Sources: Vocals, Drums, Bass, Other
      </p>

      {/* Navigation Tabs */}
      <div className="flex justify-center gap-4 mb-8 flex-wrap">
        {[
          { key: "mixer", label: "Mixer" },
          { key: "mysongs", label: "My Songs" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-md ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-gray-700 text-gray-100 hover:bg-gray-600"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}

        <button
          onClick={() => setShowHelp(true)}
          className={`px-5 py-2 rounded-md ${
            isDark ? "bg-gray-700 text-gray-100 hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
        >
          Help
        </button>

        <button
          onClick={() => setShowAbout(true)}
          className={`px-5 py-2 rounded-md ${
            isDark ? "bg-gray-700 text-gray-100 hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
        >
          About
        </button>

        <button
          onClick={() => {
            setUser(null);
            setTab("landing");
          }}
          className={`px-5 py-2 rounded-md ${
            isDark ? "bg-gray-700 text-blue-200 hover:bg-gray-600" : "bg-gray-200 text-blue-700 hover:bg-gray-300"
          }`}
        >
          Switch User
        </button>

        <button
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          className={`px-5 py-2 rounded-md ${
            isDark ? "bg-gray-700 text-gray-100 hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
        >
          {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </button>
      </div>

      {/* Render Active Tab */}
      <div className="max-w-6xl mx-auto">
        {tab === "mixer" && (
          <Mixer 
            onSave={handleSaveMix} 
            initialGains={mixerGains}
            autoPlay={autoPlayMix}
            onPlayComplete={() => setAutoPlayMix(false)} // Reset after play starts
            userModel={userModelRef.current}
            userId={user}
            theme={theme}
          />
        )}
        {tab === "mysongs" && <MySongs onSelect={handleSongSelect} onDelete={handleDeleteSong} songs={songs} theme={theme} />}
      </div>

      {/* Modals */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Footer */}
      <footer className="text-center text-sm text-gray-400 mt-8">
        Have feedback? Write to us at muse_io@gmail.com
      </footer>
    </div>
  );
}
