import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import Avatar from "./Avatar.jsx";
import ProfileModal from "./ProfileModal.jsx";

const Navbar = () => {
  const { authUser, logout } = useAuthStore();
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <header className="border-b border-line bg-panel px-5 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-signal animate-blink" />
        <h1 className="font-display font-semibold text-frost tracking-tight">
          ChatSpace
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-2 hover:opacity-80 transition"
          title="Edit profile picture"
        >
          <Avatar name={authUser?.fullName} src={authUser?.profilePic} size="sm" />
          <span className="text-sm text-frost hidden sm:inline">
            {authUser?.fullName}
          </span>
        </button>
        <button
          onClick={logout}
          className="text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-md border border-line text-mist hover:text-frost hover:border-mist transition"
        >
          Logout
        </button>
      </div>

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </header>
  );
};

export default Navbar;
