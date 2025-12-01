// import React, { useState, useEffect } from "react";

// export default function Landing({ onSelect }) {
//   const [users, setUsers] = useState(["Alex", "Sam", "Jamie"]);
//   const [showAdd, setShowAdd] = useState(false);
//   const [newUser, setNewUser] = useState("");

//   useEffect(() => {
//     const stored = localStorage.getItem("users");
//     if (stored) {
//       try { setUsers(JSON.parse(stored)); } catch {}
//     }
//   }, []);

//   useEffect(() => {
//     localStorage.setItem("users", JSON.stringify(users));
//   }, [users]);

//   const addUser = () => {
//     const name = newUser.trim();
//     if (name && !users.includes(name)) {
//       setUsers([...users, name]);
//       setNewUser("");
//       setShowAdd(false);
//     } else {
//       alert("Invalid or duplicate user name.");
//     }
//   };

//   return (
//     <div className="flex flex-col items-center justify-center h-screen">
//       <h1 className="text-3xl font-bold mb-6">🎧 AudioMix Profiles</h1>

//       <div className="flex gap-6 flex-wrap justify-center mb-6">
//         {users.map((name) => (
//           <div
//             key={name}
//             onClick={() => onSelect(name)}
//             className="cursor-pointer w-32 h-32 bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center rounded-xl font-semibold text-black hover:scale-105 transition"
//           >
//             {name}
//           </div>
//         ))}
//       </div>

//       <button
//         onClick={() => setShowAdd(true)}
//         className="mt-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md text-black font-semibold"
//       >
//         ➕ Add User
//       </button>

//       {showAdd && (
//         <div
//           className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
//           onClick={() => setShowAdd(false)}
//         >
//           <div
//             className="bg-[#171b2e] p-6 rounded-xl shadow-lg modal-panel"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <h2 className="text-lg font-semibold mb-3">Add New User</h2>
//             <input
//               type="text"
//               placeholder="Enter name"
//               value={newUser}
//               onChange={(e) => setNewUser(e.target.value)}
//               className="w-full p-2 rounded-md text-black mb-3"
//             />
//             <div className="flex justify-end gap-3">
//               <button
//                 onClick={() => setShowAdd(false)}
//                 className="bg-gray-500 px-3 py-1 rounded-md text-sm"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={addUser}
//                 className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md text-sm text-black font-semibold"
//               >
//                 Add
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }






import React, { useState, useEffect } from "react";

export default function Landing({ onSelectUser }) {
  // Load users from localStorage on mount
  const [users, setUsers] = useState(() => {
    const stored = localStorage.getItem("audioMixUsers");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing stored users:", e);
      }
    }
    return ["Alex", "Sam", "Jamie"]; // Default users
  });

  // Save users to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("audioMixUsers", JSON.stringify(users));
  }, [users]);

  const handleAddUser = () => {
    const name = prompt("Enter new username:");
    if (name && name.trim()) {
      const trimmedName = name.trim();
      if (!users.includes(trimmedName)) {
        setUsers((prev) => [...prev, trimmedName]);
      } else {
        alert("User already exists!");
      }
    }
  };

  return (
    <div className="text-center mt-16">
      <h2 className="text-2xl font-semibold mb-4 flex items-center justify-center gap-2">
        Machine Enhanced User Sounds Experience (MUSE)
      </h2>
      <div className="mb-8 px-4">
        <p className="text-lg font-semibold text-blue-400 mb-2">Powered by AI Music Source Separation</p>
        <p className="text-sm text-muted max-w-2xl mx-auto">
          Using advanced AI to separate music into <b className="text-primary">4 sources</b>: Vocals, Drums, Bass, and Other instruments
        </p>
      </div>

      {/* Profile List */}
      <div className="flex justify-center gap-6 flex-wrap mb-6">
        {users.map((user, idx) => (
          <div
          key={idx}
          onClick={() =>
            typeof onSelectUser === "function" && onSelectUser(user)
          } // Safe function call
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-10 py-12 rounded-xl cursor-pointer transition"
        >
          {user}
        </div>
      ))}
    </div>

      {/* Add User Button */}
      <button
        onClick={handleAddUser}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
      >
        + Add User
      </button>
    </div>
  );
}
