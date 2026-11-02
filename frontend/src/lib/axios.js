import axios from "axios";

// Relative by default (Vite proxy in dev, nginx in Docker, Express on Render,
// a Vercel rewrite on Vercel). `??` so an explicitly empty value stays empty.
const API_URL = import.meta.env.VITE_API_URL ?? "";

export const axiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // send the httpOnly JWT cookie
  // Free hosts can take ~1 minute to wake from sleep: wait for them instead
  // of failing instantly, but never hang forever.
  timeout: 60000,
});
