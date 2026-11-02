import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./store/useAuthStore.js";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import Navbar from "./components/Navbar.jsx";
import ToastContainer from "./components/ToastContainer.jsx";

function App() {
  const { authUser, checkAuth, isCheckingAuth, serverWaking } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) {
    return (
      <div className="h-dvh flex items-center justify-center bg-ink text-frost font-mono text-sm">
        <span className="animate-blink text-center px-6 max-w-md">
          {serverWaking
            ? "Waking up the server… free hosting sleeps when idle, so the first load can take up to a minute."
            : "establishing session..."}
        </span>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="h-dvh bg-ink text-frost font-body flex flex-col">
      {authUser && <Navbar />}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={authUser ? <HomePage /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignupPage /> : <Navigate to="/" />}
          />
        </Routes>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
