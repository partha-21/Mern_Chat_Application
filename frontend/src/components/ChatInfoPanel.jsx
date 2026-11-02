import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import { useChatStore } from "../store/useChatStore.js";
import { formatLastSeen } from "../lib/format.js";
import Avatar from "./Avatar.jsx";

// Right-hand panel. For a DM: the person. For a group: editable name,
// member list with roles/status, add/remove members (admins), and leave.
const ChatInfoPanel = ({ channel, onClose }) => {
  const { authUser, onlineUsers } = useAuthStore();
  const { users, lastSeen, renameGroup, addMembers, removeMember } = useChatStore();

  const isGroup = channel.type === "group";
  const isAdmin = channel.admins?.includes(authUser._id);
  const [name, setName] = useState(channel.name || "");
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(channel.name || ""), [channel.name]);

  const status = (u) =>
    onlineUsers.includes(u._id) ? (
      <span className="text-signal">online</span>
    ) : (
      formatLastSeen(lastSeen[u._id] ?? u.lastSeen)
    );

  const candidates = users.filter((u) => !channel.members.some((m) => m._id === u._id));
  const togglePick = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const saveName = async () => {
    setBusy(true);
    await renameGroup(channel._id, name.trim());
    setBusy(false);
  };
  const submitAdd = async () => {
    setBusy(true);
    if (await addMembers(channel._id, picked)) {
      setPicked([]);
      setAdding(false);
    }
    setBusy(false);
  };
  const leave = () => {
    if (window.confirm("Leave this group? You'll lose access to its messages.")) {
      removeMember(channel._id, authUser._id);
    }
  };
  const kick = (u) => {
    if (window.confirm(`Remove ${u.fullName} from the group?`)) removeMember(channel._id, u._id);
  };

  const other = !isGroup ? channel.members.find((m) => m._id !== authUser._id) : null;

  return (
    <aside className="w-full h-full bg-panel border-l border-line flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between shrink-0">
        <h3 className="font-display font-semibold text-frost text-sm">{isGroup ? "Group info" : "User info"}</h3>
        <button onClick={onClose} className="text-mist hover:text-frost" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar name={isGroup ? channel.name : other?.fullName} src={other?.profilePic} size="xl" />
          {isGroup && isAdmin ? (
            <div className="flex gap-2 w-full">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-md bg-raised border border-line text-frost text-sm text-center focus:outline-none focus:border-signal"
              />
              {name.trim() && name.trim() !== channel.name && (
                <button
                  onClick={saveName}
                  disabled={busy}
                  className="px-3 rounded-md bg-signal text-ink text-xs font-semibold disabled:opacity-50"
                >
                  Save
                </button>
              )}
            </div>
          ) : (
            <p className="font-display font-semibold text-frost">{isGroup ? channel.name : other?.fullName}</p>
          )}
          <p className="text-xs font-mono text-mist">
            {isGroup ? `${channel.members.length} members` : status(other)}
          </p>
          {!isGroup && other?.email && <p className="text-xs text-mist">{other.email}</p>}
        </div>

        {isGroup && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-mono uppercase tracking-widest text-mist">Members</h4>
                {isAdmin && (
                  <button
                    onClick={() => setAdding((a) => !a)}
                    className="text-[11px] font-mono uppercase text-signal hover:underline"
                  >
                    {adding ? "Cancel" : "+ Add"}
                  </button>
                )}
              </div>

              {adding && (
                <div className="mb-3 border border-line rounded-lg p-1.5 space-y-0.5">
                  {candidates.length === 0 && (
                    <p className="text-xs text-mist px-2 py-2">Everyone is already in this group.</p>
                  )}
                  {candidates.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => togglePick(u._id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition ${
                        picked.includes(u._id) ? "bg-signal/10" : "hover:bg-raised"
                      }`}
                    >
                      <Avatar name={u.fullName} src={u.profilePic} size="sm" />
                      <span className="flex-1 text-sm text-frost truncate">{u.fullName}</span>
                      {picked.includes(u._id) && <span className="text-signal text-xs">✓</span>}
                    </button>
                  ))}
                  {picked.length > 0 && (
                    <button
                      onClick={submitAdd}
                      disabled={busy}
                      className="w-full mt-1 py-1.5 rounded-md bg-signal text-ink text-xs font-semibold disabled:opacity-50"
                    >
                      Add {picked.length} {picked.length === 1 ? "member" : "members"}
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-0.5">
                {channel.members.map((u) => (
                  <div key={u._id} className="flex items-center gap-2 px-1 py-1.5 rounded-md">
                    <Avatar name={u.fullName} src={u.profilePic} online={onlineUsers.includes(u._id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-frost truncate">
                        {u.fullName}
                        {u._id === authUser._id && <span className="text-mist"> (you)</span>}
                        {channel.admins?.includes(u._id) && (
                          <span className="ml-1.5 text-[9px] font-mono uppercase text-signal border border-signal/40 rounded px-1 py-0.5">
                            admin
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-mono text-mist truncate">{status(u)}</p>
                    </div>
                    {isAdmin && u._id !== authUser._id && (
                      <button
                        onClick={() => kick(u)}
                        className="text-mist hover:text-danger text-xs px-1"
                        title="Remove from group"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={leave}
              className="w-full py-2 rounded-md border border-danger/40 text-danger text-sm hover:bg-danger/10 transition"
            >
              Leave group
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default ChatInfoPanel;
