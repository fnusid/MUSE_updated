import React from "react";

// export default function SongList({ songs = [] }) {
//   return (
//     <div className="mt-8 bg-[#171b2e]/60 p-6 rounded-xl">
//       <h3 className="text-lg mb-3">🎵 My Songs</h3>
//       <div className="space-y-3">
//         {songs.length === 0 && (
//           <div className="text-sm text-gray-400">No saved mixes yet.</div>
//         )}
//         {songs.map((s, idx) => (
//           <div
//             key={s.title + idx}
//             className="flex justify-between bg-[#0e1226] p-3 rounded-lg border border-[#2a2f4a] flex-wrap"
//           >
//             <div>
//               <div className="font-semibold">{s.title}</div>
//               <div className="text-sm text-gray-400">{s.artist}</div>
//               <pre className="text-xs text-gray-400 whitespace-pre-wrap mt-1">{s.details}</pre>
//             </div>
//             <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md text-sm mt-2 h-8">
//               ▶ Play
//             </button>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

export default function SongList({ songs = [], onSelect }) {
  return (
    <div>
      {songs.map((song) => (
        <div key={song.title}>
          <span>{song.title}</span>
          <button onClick={() => onSelect?.(song)}>Play</button>
        </div>
      ))}
    </div>
  );
}