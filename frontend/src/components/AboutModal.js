import React from "react";

export default function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="panel rounded-xl p-6 max-w-lg shadow-lg modal-panel text-primary" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary">
          <span>About AI Music Source Separation</span>
        </h2>
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            This prototype explores <b className="text-primary">Human–Audio Interaction (HAI)</b> for interactive music
            source separation and remixing using <b className="text-blue-400">AI-powered technology</b>.
          </p>
          <p>
            The system uses <b className="text-blue-400">Demucs</b>, a state-of-the-art deep learning model, to automatically
            decompose songs into separate audio stems using artificial intelligence.
          </p>
          <div className="surface rounded-lg p-3 mt-4">
            <p className="font-semibold text-yellow-400 mb-2">AI Limitation:</p>
            <p>
              The AI model separates music into exactly <b className="text-primary">4 sources</b>: 
              <b className="text-blue-400"> Vocals</b>, <b className="text-yellow-400">Drums</b>, 
              <b className="text-green-400"> Bass</b>, and <b className="text-purple-400">Other instruments</b>.
              Complex instruments may be grouped together in the "Other" category.
            </p>
          </div>
        </div>
        <button onClick={onClose} className="mt-4 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md text-black font-semibold">
          OK
        </button>
      </div>
    </div>
  );
}
