import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { formatListTime, previewOf } from "../lib/format.js";
import Avatar from "./Avatar.jsx";
import CreateGroupModal from "./CreateGroupModal.jsx";

// Telegram-style chat list: avatar, name, last-message preview with
// "You:" / sender prefix, time, read ticks for your own last message,
// an unread badge, and a live "typing…" in place of the preview.
const Sidebar = () => {
  const {
    users, channels, getUsers, getChannels, openDirectChannel,
    selectChannel, selectedChannelId, typing,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getUsers();
    getChannels();
  }, [getUsers, getChannels]);

  const otherOf = (c) => (c.type === "direct" ? c.members.find((m) => m._id !== authUser._id) : null);
  const labelOf = (c) => (c.type === "group" ? c.name : otherOf(c)?.fullName || "Unknown");

  const q = query.trim().toLowerCase();
  const shownChannels = q ? channels.filter((c) => labelOf(c).toLowerCase().includes(q)) : channels;
  const shownUsers = q ? users.filter((u) => u.fullName.toLowerCase().includes(q)) : users;

  const previewFor = (c) => {
    const typers = Object.values(typing[c._id] || {});
    if (typers.length) {
      return (
        <span className="text-signal">
          {c.type === "group" ? `${typers[0]} is typing…` : "typing…"}
        </span>
      );
    }
    const last = c.lastMessage;
    if (!last) return "No messages yet";
    const mine = last.senderId?._id === authUser._id;
    const prefix = mine ? "You: " : c.type === "group" ? `${last.senderId?.fullName?.split(" ")[0]}: ` : "";
    return `${prefix}${previewOf(last)}`;
  };

  const lastIsReadByOthers = (c) =>
    c.lastMessage?.seenBy?.some((id) => id !== authUser._id) ?? false;

  return (
    <aside className="w-full h-full border-r border-line bg-panel flex flex-col">
      <div className="p-3 border-b border-line flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats and people"
          className="flex-1 min-w-0 px-3 py-1.5 rounded-full bg-raised border border-line text-sm text-frost placeholder:text-mist focus:outline-none focus:border-signal"
        />
        <button
          onClick={() => setShowGroupModal(true)}
          className="text-[11px] font-mono uppercase tracking-wide px-2.5 py-1.5 rounded-full border border-line text-mist hover:text-signal hover:border-signal/50 transition shrink-0"
          title="Create a group"
        >
          + Group
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {shownChannels.length === 0 && (
          <p className="text-xs text-mist px-4 py-4 leading-relaxed">
            {q ? "No chats match your search." : "No chats yet — pick someone below to start one."}
          </p>
        )}
        {shownChannels.map((c) => {
          const other = otherOf(c);
          const active = selectedChannelId === c._id;
          const mineLast = c.lastMessage?.senderId?._id === authUser._id;
          return (
            <button
              key={c._id}
              onClick={() => selectChannel(c._id)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-raised transition border-l-2 ${
                active ? "bg-raised border-signal" : "border-transparent"
              }`}
            >
              <Avatar
                name={labelOf(c)}
                src={other?.profilePic}
                online={other ? onlineUsers.includes(other._id) : false}
                size="lg"
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-frost truncate">
                    {labelOf(c)}
                    {c.type === "group" && (
                      <span className="ml-1.5 text-[9px] font-mono uppercase text-mist border border-line rounded px-1 py-0.5 align-middle">
                        group
                      </span>
                    )}
                  </span>
                  {c.lastMessage && (
                    <span className="text-[10px] font-mono text-mist shrink-0 flex items-center gap-1">
                      {mineLast && (
                        <span className={lastIsReadByOthers(c) ? "text-signal" : ""}>
                          {lastIsReadByOthers(c) ? "✓✓" : "✓"}
                        </span>
                      )}
                      {formatListTime(c.lastMessage.createdAt)}
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-mist truncate">{previewFor(c)}</span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-signal text-ink text-[10px] font-mono font-semibold flex items-center justify-center">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-line">
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-mist mb-2">People</h2>
        <div className="max-h-36 overflow-y-auto space-y-0.5">
          {shownUsers.length === 0 && (
            <p className="text-xs text-mist px-2 py-1.5">
              {q ? "Nobody matches." : "No other users yet — invite someone to sign up."}
            </p>
          )}
          {shownUsers.map((u) => (
            <button
              key={u._id}
              onClick={() => openDirectChannel(u._id)}
              className="w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 hover:bg-raised transition"
            >
              <Avatar name={u.fullName} src={u.profilePic} online={onlineUsers.includes(u._id)} size="sm" />
              <span className="text-sm text-frost truncate">{u.fullName}</span>
            </button>
          ))}
        </div>
      </div>

      {showGroupModal && (
        <CreateGroupModal users={users} onClose={() => setShowGroupModal(false)} />
      )}
    </aside>
  );
};

export default Sidebar;
