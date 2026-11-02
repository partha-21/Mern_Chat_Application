import { io } from "socket.io-client";
import { axiosInstance } from "./axios.js";

// Singleton. Created once per login; socket.io reconnects by itself, so we
// must NOT create a second socket while one exists.
let socket = null;

// Where the realtime server lives. Empty = same origin (Express on Render,
// nginx in Docker, the Vite proxy in dev). For a Vercel-hosted frontend set
// VITE_SOCKET_URL to the Render API URL: Vercel can't proxy WebSockets.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

export const connectSocket = () => {
  if (socket) return socket;

  const s = io(SOCKET_URL, {
    // A function is re-run on EVERY (re)connect, so the 2-minute token is
    // always fresh. The token comes from a normal REST call (cookie-auth'd,
    // same-origin), which is why this works even when the site and the API
    // live on different domains and the session cookie can't follow.
    auth: async (cb) => {
      try {
        const res = await axiosInstance.get("/auth/socket-token");
        cb({ token: res.data.token });
      } catch {
        cb({}); // server falls back to the session cookie (same-origin setups)
      }
    },
  });

  // When the server REJECTS a handshake (e.g. the free instance is still
  // booting, or the session expired) socket.io does not retry on its own.
  s.on("connect_error", () => {
    if (!s.active) {
      setTimeout(() => {
        if (socket === s && !s.connected) s.connect();
      }, 3000);
    }
  });

  socket = s;
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
