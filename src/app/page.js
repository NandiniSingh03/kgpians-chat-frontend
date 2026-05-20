"use client"; 

import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("https://kgpians-chat-backend.onrender.com");

export default function Home() {
  const [cht, newcht] = useState(["1st Years", "2nd Years", "3rd Years", "4th Years"]); 
  const [activecht, newactivecht] = useState("1st Years"); 
  const [msgs, newmsgs] = useState([]); 
  const [draft, newdraft] = useState(""); 
  const [username, setUsername] = useState(""); 
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [newgrp, setnewgrp] = useState(""); 

  useEffect(() => {
    function receiveMessageEvent(envelope) {
      newactivecht((currentRoom) => {
        if (envelope.grp === currentRoom) {
          newmsgs((prev) => {
            // Prevent duplication by checking identity signatures
            const isDuplicate = prev.some(m => m.timestamp === envelope.timestamp && m.body === envelope.body && m.sender === envelope.sender);
            if (isDuplicate) return prev;
            return prev.concat(envelope);
          }); 
        }
        return currentRoom;
      });
    }

    function historyLoadEvent(archiveLog) {
      newmsgs(archiveLog || []); 
    }

    function groupCreatedEvent(freshRoom) {
      newcht((existingSpaces) => {
        if (!existingSpaces.includes(freshRoom)) {
          return existingSpaces.concat(freshRoom);
        }
        return existingSpaces;
      });
    }

    function groupDeletedEvent(purgedSpace) {
      newcht((existingSpaces) => existingSpaces.filter((room) => room !== purgedSpace));
      newactivecht((currentSpaceView) => currentSpaceView === purgedSpace ? "1st Years" : currentSpaceView);
    }

    socket.on("receivemsg", receiveMessageEvent);
    socket.on("history", historyLoadEvent);
    socket.on("grpcreated", groupCreatedEvent);
    socket.on("grpdeleted", groupDeletedEvent);

    if (isLoggedIn) {
      socket.emit("joingrp", activecht);
    }

    return function cleanup() {
      socket.off("receivemsg", receiveMessageEvent);
      socket.off("history", historyLoadEvent);
      socket.off("grpcreated", groupCreatedEvent);
      socket.off("grpdeleted", groupDeletedEvent);
    };
  }, [activecht, isLoggedIn]); 

  function login(eventItem) {
    eventItem.preventDefault(); 
    if (username.trim()) {
      setIsLoggedIn(true); 
    }
  }

  function Creategrp(eventItem) {
    eventItem.preventDefault();
    const cleanTitle = newgrp.trim(); 
    if (cleanTitle && !cht.includes(cleanTitle)) {
      socket.emit("create_room", cleanTitle); 
      newcht((prev) => prev.concat(cleanTitle));
      newmsgs([]); 
      newactivecht(cleanTitle); 
      setnewgrp(""); 
    }
  }

  function delgrp(targetKey, eventItem) {
    eventItem.stopPropagation(); 
    if (targetKey === "1st Years") {
      alert("bro, you cannot delete the main 1st Years group!");
      return;
    }
    if (confirm(`you sure you want to delete "# ${targetKey}"?`)) {
      socket.emit("delete_room", targetKey); 
      newcht(cht.filter((room) => room !== targetKey));
      if (activecht === targetKey) {
        newactivecht("1st Years");
      }
    }
  }

  function sndmsg(eventItem) {
    eventItem.preventDefault();
    if (!draft.trim()) return; 

    const structuralEnvelope = {
      grp: activecht, 
      sender: username, 
      body: draft, 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };

    // Let the server push the data down dynamically to maintain synchronization
    socket.emit("sendmsg", structuralEnvelope); 
    newdraft(""); 
  }

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

  return (
    <div className="flex h-screen w-screen bg-zinc-900 text-white font-sans overflow-hidden">
      <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 font-bold text-xl tracking-wide text-teal-400 bg-teal-950/20">
          KGPIANS-CHAT
        </div>
        <div className="flex-1 p-3 overflow-y-auto space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase px-2 mb-2">Channels</p>
          {cht.map(function (room) {
            return (
              <div
                key={room}
                onClick={() => {
                  newmsgs([]); 
                  newactivecht(room);
                }} 
                className={`group flex items-center justify-between px-3 py-2 rounded-md transition text-sm font-medium cursor-pointer ${
                  activecht === room ? "bg-teal-900/50 text-teal-200 border-l-2 border-teal-500" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span># {room}</span>
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
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-500">
          Identity: <span className="text-zinc-300 font-semibold">{username}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-teal-950/20">
        <div className="h-16 flex items-center px-6 bg-teal-700 shadow-sm border-b border-teal-800">
          <h2 className="font-bold text-lg text-white"># {activecht}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
          {msgs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center mt-4">nothing here yet. type something to start talking!</p>
          ) : (
            msgs.map(function (msg, structuralIndex) {
              const belongsToMe = msg.sender === username;
              return (
                <div key={structuralIndex} className={`flex flex-col max-w-[70%] ${belongsToMe ? "self-end items-end" : "self-start items-start"}`}>
                  <span className="text-xs text-zinc-400 mb-1 px-1">
                    {belongsToMe ? "You" : msg.sender} • {msg.timestamp}
                  </span>
                  <div className={`rounded-2xl px-4 py-2 text-sm shadow-md leading-relaxed ${belongsToMe ? "bg-cyan-500 text-zinc-950 rounded-tr-none font-medium" : "bg-zinc-100 text-zinc-900 rounded-tl-none"}`}>
                    {msg.body}
                  </div>
                </div>
              );
            })
          )}
        </div>
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