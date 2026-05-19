"use client"; // Tells Next.js that this page is interactive

import { useState, useEffect } from "react";
import { io } from "socket.io-client";

// Connect to our Node.js backend server running on port 5000
const socket = io("https://kgpians-chat-backend.onrender.com");

export default function Home() {
  // --- STATE REGISTRIES (Variables that update the screen instantly) ---
  const [cht, newcht] = useState(["1st Years", "2nd Years", "3rd Years", "4th Years"]); // List of group names
  const [activecht, newactivecht] = useState("1st Years"); // The group the user is currently looking at
  const [msgs, newmsgs] = useState([]); // Array to store messages for the active group
  const [draft, newdraft] = useState(""); // Holds the text while typing in the input box
  const [username, setUsername] = useState(""); // Stores the user's nickname
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Tracks if the user has entered their name and logged in
  const [newgrp, setnewgrp] = useState(""); // Holds the text when creating a new channel name

  // --- ASYNCHRONOUS NETWORK CHANNEL WATCHERS (Listening to the backend) ---
  useEffect(() => {
    
    // Triggered when a new message arrives from the server
    function receiveMessageEvent(envelope) {
      // Only show the message if it belongs to the group we are currently viewing
      if (envelope.grp === activecht) {
        newmsgs(function (prev) {
          return prev.concat(envelope); // Add the new message to our screen's list
        });
      }
    }

    // Triggered right when entering a room to load all its past chat messages
    function historyLoadEvent(archiveLog) {
      newmsgs(archiveLog); // Replace the screen messages with the room's stored history
    }

    // Triggered when someone else creates a new channel globally
    function groupCreatedEvent(freshRoom) {
      newcht(function (existingSpaces) {
        // If the channel isn't already in our sidebar list, add it
        if (!existingSpaces.includes(freshRoom)) {
          return existingSpaces.concat(freshRoom);
        }
        return existingSpaces;
      });
    }

    // Triggered when someone deletes a group globally
    function groupDeletedEvent(purgedSpace) {
      // Remove the deleted room from our sidebar list
      newcht(function (existingSpaces) {
        return existingSpaces.filter(function (room) {
          return room !== purgedSpace;
        });
      });
      // If we were inside the room that just got deleted, automatically kick us back to '1st Years'
      newactivecht(function (currentSpaceView) {
        if (currentSpaceView === purgedSpace) {
          return "1st Years";
        }
        return currentSpaceView;
      });
    }

    // Turn on the internet socket listeners for these 4 events
    socket.on("receivemsg", receiveMessageEvent);
    socket.on("history", historyLoadEvent);
    socket.on("grpcreated", groupCreatedEvent);
    socket.on("grpdeleted", groupDeletedEvent);

    // If logged in, tell the backend to immediately connect us to our current room channel
    if (isLoggedIn) {
      socket.emit("joingrp", activecht);
    }

    // Cleanup function: Turns off the listeners when switching rooms to avoid duplicate notifications
    return function cleanup() {
      socket.off("receivemsg", receiveMessageEvent);
      socket.off("history", historyLoadEvent);
      socket.off("grpcreated", groupCreatedEvent);
      socket.off("grpdeleted", groupDeletedEvent);
    };
  }, [activecht, isLoggedIn]); // Re-run this effect block whenever the user changes groups or logs in

  // --- FUNCTION ROUTINES (User Actions) ---

  // Handles submitting the login nickname form
  function login(eventItem) {
    eventItem.preventDefault(); // Stop the page from reloading
    if (username.trim()) {
      setIsLoggedIn(true); // Log the user in
      socket.emit("joingrp", activecht); // Enter the default landing group
    }
  }

  // Handles adding a new channel to the sidebar
  function Creategrp(eventItem) {
    eventItem.preventDefault();
    const cleanTitle = newgrp.trim(); // Remove accidental spaces
    // Only create it if it has a name and isn't a duplicate
    if (cleanTitle && !cht.includes(cleanTitle)) {
      socket.emit("create_room", cleanTitle); // Tell backend to announce this new room globally
      newcht(cht.concat(cleanTitle)); // Add it to our own sidebar
      newactivecht(cleanTitle); // Switch our view directly to this new room
      setnewgrp(""); // Clear the input field
    }
  }

  // Handles clicking the delete button (X) on custom channels
  function delgrp(targetKey, eventItem) {
    eventItem.stopPropagation(); // Prevents the click from accidentally selecting the room instead of deleting it
    // Safety check: Block deleting the primary baseline channel
    if (targetKey === "1st Years") {
      alert("bro, you cannot delete the main 1st Years group!");
      return;
    }
    // Confirmation alert box
    if (confirm(`you sure you want to delete "# ${targetKey}"?`)) {
      socket.emit("delete_room", targetKey); // Tell backend to delete it globally
      newcht(cht.filter(function (room) {
        return room !== targetKey; // Remove it from our local sidebar list
      }));
      // If we just deleted the room we were currently viewing, switch us back to 1st Years
      if (activecht === targetKey) {
        newactivecht("1st Years");
      }
    }
  }

  // Handles sending a text message
  function sndmsg(eventItem) {
    eventItem.preventDefault();
    if (!draft.trim()) return; // Don't send empty messages

    // Package the data up into a clean structural object
    const structuralEnvelope = {
      grp: activecht, // Current active group name
      sender: username, // Who sent it
      body: draft, // The message content
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) // Clock time
    };

    socket.emit("sendmsg", structuralEnvelope); // Transmit the message object to the server
    newmsgs(msgs.concat(structuralEnvelope)); // Show it on our own screen immediately
    newdraft(""); // Clear the message input bar
  }

  // --- RENDERING 1: NICKNAME LOGIN INTERFACE ---
  if (!isLoggedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-900 text-white">
        <form onSubmit={login} className="bg-zinc-950 p-8 rounded-lg border border-zinc-800 space-y-4 w-80">
          <h2 className="text-xl font-bold text-teal-400 text-center">Enter Chat Nickname</h2>
          <input
            type="text"
            placeholder="Type your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm outline-none focus:border-teal-500 text-zinc-100"
            required
          />
          <button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 py-2 rounded text-sm font-semibold transition">
            Join Chatroom
          </button>
        </form>
      </div>
    );
  }

  // --- RENDERING 2: MAIN DISCORD-STYLE WORKSPACE ---
  return (
    <div className="flex h-screen w-screen bg-zinc-900 text-white font-sans overflow-hidden">
      
      {/* --- SIDEBAR PANEL (Channels & Creation Panel) --- */}
      <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 font-bold text-xl tracking-wide text-teal-400 bg-teal-950/20">
          KGPIANS-CHAT
        </div>
        
        {/* Render out the array list of channels dynamically */}
        <div className="flex-1 p-3 overflow-y-auto space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase px-2 mb-2">Channels</p>
          {cht.map(function (room) {
            return (
              <div
                key={room}
                onClick={() => newactivecht(room)} // Click to switch active rooms
                className={`group flex items-center justify-between px-3 py-2 rounded-md transition text-sm font-medium cursor-pointer ${
                  activecht === room ? "bg-teal-900/50 text-teal-200 border-l-2 border-teal-500" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span># {room}</span>
                {/* Show the delete cross button only if it isn't the protected 1st Years channel */}
                {room !== "1st Years" && (
                  <button
                    onClick={(e) => delgrp(room, e)}
                    className="text-zinc-500 hover:text-red-400 text-xs font-bold px-1 rounded transition opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Form box at the bottom of sidebar to add a brand new group channel */}
        <form onSubmit={Creategrp} className="p-3 border-t border-zinc-800 space-y-2">
          <input
            type="text"
            placeholder="New channel name..."
            value={newgrp}
            onChange={(e) => setnewgrp(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs outline-none focus:border-teal-500 text-zinc-100"
          />
          <button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 text-white py-1.5 px-3 rounded text-xs font-semibold transition">
            + Add Channel
          </button>
        </form>

        {/* Shows who you are currently logged in as */}
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-500">
          Identity: <span className="text-zinc-300 font-semibold">{username}</span>
        </div>
      </div>

      {/* --- MAIN RIGHT-SIDE CONTENT PANEL (Chat Stream View) --- */}
      <div className="flex-1 flex flex-col bg-teal-950/20">
        
        {/* Top Header Row featuring Active Group Title */}
        <div className="h-16 flex items-center px-6 bg-teal-700 shadow-sm border-b border-teal-800">
          <h2 className="font-bold text-lg text-white"># {activecht}</h2>
        </div>

        {/* Scrolling logs display viewport for actual conversations */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
          {msgs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center mt-4">nothing here yet. type something to start talking!</p>
          ) : (
            msgs.map(function (msg, structuralIndex) {
              const belongsToMe = msg.sender === username; // Check if the message came from us or a peer
              return (
                <div key={structuralIndex} className={`flex flex-col max-w-[70%] ${belongsToMe ? "self-end items-end" : "self-start items-start"}`}>
                  {/* Sender Metadata details */}
                  <span className="text-xs text-zinc-400 mb-1 px-1">
                    {belongsToMe ? "You" : msg.sender} • {msg.timestamp}
                  </span>
                  {/* Styled Message chat bubble tailored depending on sender identity */}
                  <div className={`rounded-2xl px-4 py-2 text-sm shadow-md leading-relaxed ${belongsToMe ? "bg-cyan-500 text-zinc-950 rounded-tr-none font-medium" : "bg-zinc-100 text-zinc-900 rounded-tl-none"}`}>
                    {msg.body}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Typing Entry Bar and Submit Interface */}
        <form onSubmit={sndmsg} className="p-4 bg-zinc-950/30 border-t border-zinc-800">
          <div className="flex items-center space-x-2 bg-zinc-800 rounded-lg px-4 py-2.5 focus-within:ring-2 focus-within:ring-teal-500">
            <input
              type="text"
              value={draft}
              onChange={(e) => newdraft(e.target.value)}
              placeholder={`Message #${activecht}`}
              className="bg-transparent flex-1 outline-none text-zinc-200 text-sm placeholder-zinc-500"
            />
            <button type="submit" className="text-teal-400 hover:text-teal-300 font-semibold text-sm transition px-2">
              Send
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}