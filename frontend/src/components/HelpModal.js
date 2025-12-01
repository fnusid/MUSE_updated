import React from "react";

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="panel rounded-xl p-6 max-w-lg shadow-lg modal-panel text-primary" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary">
          <span>How to Use AI Music Source Separation</span>
        </h2>
        <ul className="space-y-2 text-sm text-muted mb-4">
          <li><b>Upload</b> a music file (WAV, MP3, FLAC)</li>
          <li><b>Wait</b> for AI to separate the audio into 4 sources</li>
          <li><b>Adjust</b> sliders for the 4 AI-separated sources:
            <ul className="ml-6 mt-1 space-y-1 text-xs">
              <li>- <span className="text-blue-400">Vocals</span></li>
              <li>- <span className="text-yellow-400">Drums</span></li>
              <li>- <span className="text-green-400">Bass</span></li>
              <li>- <span className="text-purple-400">Other</span> (instruments)</li>
            </ul>
          </li>
          <li><b>Play</b> your custom mix in real-time</li>
          <li><b>Save</b> your custom mix (avoids duplicates)</li>
          <li><b>Access</b> saved mixes under "My Songs"</li>
        </ul>
        <div className="surface border border-yellow-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-600">
            <b>Note:</b> AI separates into exactly 4 sources. Complex arrangements may group multiple instruments together.
          </p>
        </div>
        <button onClick={onClose} className="mt-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md text-black font-semibold">
          OK
        </button>
      </div>
    </div>
  );
}
