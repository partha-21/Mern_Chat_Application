import { useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import { useToastStore } from "../store/useToastStore.js";
import Avatar from "./Avatar.jsx";

// Matches the 10mb JSON body limit set in the backend's express.json()
// config (server.js) — base64 encoding adds ~33% overhead, so we cap the
// ORIGINAL file well below that to leave headroom and fail client-side
// with a clear message instead of a confusing 500 from the server.
const MAX_FILE_SIZE_MB = 5;

const ProfileModal = ({ onClose }) => {
  const { authUser, updateProfile } = useAuthStore();
  const { addToast } = useToastStore();
  const [preview, setPreview] = useState(authUser?.profilePic || null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("That file isn't an image");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      addToast(`Image must be under ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!preview || preview === authUser?.profilePic) {
      onClose();
      return;
    }

    setIsSaving(true);
    const result = await updateProfile(preview);
    setIsSaving(false);

    if (result.success) {
      addToast("Profile picture updated", "success");
      onClose();
    } else {
      addToast(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-frost">
            Profile picture
          </h3>
          <button
            onClick={onClose}
            className="text-mist hover:text-frost transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 mb-5">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="w-24 h-24 rounded-full object-cover border border-line"
            />
          ) : (
            <Avatar name={authUser?.fullName} size="lg" />
          )}

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            className="cursor-pointer text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-md border border-line text-mist hover:text-signal hover:border-signal/50 transition"
          >
            Choose image
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-line text-mist text-sm hover:text-frost hover:border-mist transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 rounded-md bg-signal hover:bg-signal-dim disabled:opacity-50 text-ink text-sm font-semibold transition"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
