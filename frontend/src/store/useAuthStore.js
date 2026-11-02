import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { connectSocket, disconnectSocket } from "../lib/socket.js";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  serverWaking: false,
  isSigningUp: false,
  isLoggingIn: false,
  onlineUsers: [],

  checkAuth: async () => {
    const MAX_TRIES = 12;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const res = await axiosInstance.get("/auth/check");
        set({ authUser: res.data, serverWaking: false });
        get().connectSocket();
        break;
      } catch (error) {
        const status = error.response?.status;
        const notUpYet = !error.response || status >= 502;
        if (notUpYet && attempt < MAX_TRIES) {
          set({ serverWaking: true });
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        set({ authUser: null });
        break;
      }
    }
    set({ isCheckingAuth: false, serverWaking: false });
  },

  signup: async (formData) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", formData);
      set({ authUser: res.data });
      get().connectSocket();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Signup failed",
      };
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (formData) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", formData);
      set({ authUser: res.data });
      get().connectSocket();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null, onlineUsers: [] });
      disconnectSocket();
    } catch (error) {
      console.error("Logout failed", error);
    }
  },

  updateProfile: async (profilePicBase64) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", {
        profilePic: profilePicBase64,
      });
      set((state) => ({ authUser: { ...state.authUser, ...res.data } }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update profile",
      };
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return;

    const socket = connectSocket();

    socket.off("getOnlineUsers");
    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },
}));
