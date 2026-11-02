import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { useChatStore } from "../store/useChatStore.js";

// Modal for creating a group channel — calls POST /api/channels/group
// (already implemented on the backend in channel.controller.js).
const CreateGroupModal = ({ users, onClose }) => {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { createGroupChannel } = useChatStore();

  const toggleMember = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError("Give the channel a name");
      return;
    }
    if (selectedIds.length < 1) {
      setError("Add at least one member");
      return;
    }

    setIsCreating(true);
    const result = await createGroupChannel({
      name: name.trim(),
      memberIds: selectedIds,
    });
    setIsCreating(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-frost">
            New channel
          </h3>
          <button
            onClick={onClose}
            className="text-mist hover:text-frost transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="bg-danger/10 text-danger text-xs font-mono px-2 py-1.5 rounded mb-3">
            {error}
          </p>
        )}

        <label className="block text-xs font-mono uppercase tracking-wide text-mist mb-1">
          Channel name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. project-atlas"
          className="w-full mb-4 px-3 py-2 rounded-md bg-raised border border-line text-frost text-sm focus:outline-none focus:border-signal"
        />

        <label className="block text-xs font-mono uppercase tracking-wide text-mist mb-2">
          Members ({selectedIds.length} selected)
        </label>
        <div className="max-h-48 overflow-y-auto space-y-1 mb-5 border border-line rounded-md p-1.5">
          {users.length === 0 && (
            <p className="text-xs text-mist px-2 py-2">
              No other users yet — invite someone to sign up first.
            </p>
          )}
          {users.map((user) => (
            <button
              key={user._id}
              type="button"
              onClick={() => toggleMember(user._id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition ${
                selectedIds.includes(user._id)
                  ? "bg-signal/10 border border-signal/40"
                  : "hover:bg-raised border border-transparent"
              }`}
            >
              <Avatar name={user.fullName} size="sm" />
              <span className="text-sm text-frost truncate flex-1">
                {user.fullName}
              </span>
              {selectedIds.includes(user._id) && (
                <span className="text-signal text-xs font-mono">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-line text-mist text-sm hover:text-frost hover:border-mist transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 py-2 rounded-md bg-signal hover:bg-signal-dim disabled:opacity-50 text-ink text-sm font-semibold transition"
          >
            {isCreating ? "Creating..." : "Create channel"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
