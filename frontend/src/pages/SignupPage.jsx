import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";

const SignupPage = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const { signup, isSigningUp } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await signup(formData);
    if (!result.success) setError(result.message);
  };

  return (
    <div className="h-full flex items-center justify-center px-4 bg-ink">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-panel p-8 rounded-xl border border-line"
      >
        <div className="flex items-center gap-2 justify-center mb-1">
          <span className="w-2 h-2 rounded-full bg-signal animate-blink" />
          <span className="text-xs font-mono uppercase tracking-widest text-mist">
            ChatSpace
          </span>
        </div>
        <h2 className="text-2xl font-display font-semibold mb-6 text-center text-frost">
          Create an account
        </h2>

        {error && (
          <p className="bg-danger/10 text-danger text-sm font-mono px-2 py-1.5 rounded mb-4">
            {error}
          </p>
        )}

        <label className="block text-xs font-mono uppercase tracking-wide text-mist mb-1">
          Full name
        </label>
        <input
          type="text"
          required
          className="w-full mb-4 px-3 py-2 rounded-md bg-raised border border-line text-frost focus:outline-none focus:border-signal"
          value={formData.fullName}
          onChange={(e) =>
            setFormData({ ...formData, fullName: e.target.value })
          }
        />

        <label className="block text-xs font-mono uppercase tracking-wide text-mist mb-1">
          Email
        </label>
        <input
          type="email"
          required
          className="w-full mb-4 px-3 py-2 rounded-md bg-raised border border-line text-frost focus:outline-none focus:border-signal"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
        />

        <label className="block text-xs font-mono uppercase tracking-wide text-mist mb-1">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          className="w-full mb-6 px-3 py-2 rounded-md bg-raised border border-line text-frost focus:outline-none focus:border-signal"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
        />

        <button
          type="submit"
          disabled={isSigningUp}
          className="w-full bg-signal hover:bg-signal-dim disabled:opacity-50 py-2 rounded-md font-semibold text-ink transition"
        >
          {isSigningUp ? "Creating account..." : "Sign up"}
        </button>

        <p className="text-sm text-mist text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-signal hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignupPage;
