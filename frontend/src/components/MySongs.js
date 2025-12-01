import React from "react";

// Helper for rendering song cards
function SongList({ songs = [], onSelect, onDelete }) {
  return (
    <div className="flex flex-col gap-4">
      {songs.map((song, idx) => (
        <div
          key={idx}
          className="surface p-4 rounded-xl flex justify-between items-center"
        >
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{song.title}</h3>
            <p className="text-sm text-muted">{song.artist}</p>
            <p className="text-xs text-muted mt-1">{song.details}</p>
          </div>

          <div className="flex gap-2">
            {/* Safe optional call to prevent "onSelect is not a function" */}
            <button
              onClick={() => typeof onSelect === "function" && onSelect(song)}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              Play
            </button>
            {/* Delete button */}
            <button
              onClick={() => {
                if (window.confirm(`Delete "${song.title}"?`)) {
                  typeof onDelete === "function" && onDelete(idx);
                }
              }}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Single default export for the component
export default function MySongs({ onSelect, onDelete, songs = [] }) {
  return (
    <div className="relative panel backdrop-blur-lg rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-4">My Songs</h2>
      {songs.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <p>No saved songs yet.</p>
          <p className="text-sm mt-2">Create a mix in the Mixer tab and click "Save Mix" to save it here.</p>
        </div>
      ) : (
        <SongList songs={songs} onSelect={onSelect} onDelete={onDelete} />
      )}
    </div>
  );
}
