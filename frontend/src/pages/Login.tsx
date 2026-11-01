import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";

// ======================================================
// QUANTARA — PREMIUM LOGIN PAGE
// ======================================================

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.message || "");

  // ====================================================
  // FORM VALIDATION
  // ====================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;
    setError("");
    setNotice("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      setPassword("");
      const target = location.state?.from;
      navigate(typeof target === "string" && target.startsWith("/app") ? target : "/app", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally { setIsSubmitting(false); }

  }

  // ====================================================
  // LOGIN UI
  // ====================================================

  return (
    <AuthLayout mode="login">
      {/* PAGE HEADING */}

      <div className="auth-form-top">
        <span className="auth-section-label">
          <Sparkles size={14} />
          YOUR INTELLIGENT WORKSPACE
        </span>

        <h1>
          Welcome <em>back.</em>
        </h1>

        <p>
          Sign in to continue exploring the intelligence
          behind your data.
        </p>
      </div>

      {/* LOGIN FORM */}

      <form
        onSubmit={handleSubmit}
        className="auth-form"
        noValidate
      >
        {/* EMAIL */}

        <div className="auth-field">
          <label htmlFor="login-email">
            Email address
          </label>

          <div className="auth-input-wrap">
            <Mail size={18} />

            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setNotice("");
              }}
              required
            />
          </div>
        </div>

        {/* PASSWORD */}

        <div className="auth-field">
          <div className="auth-label-row">
            <label htmlFor="login-password">
              Password
            </label>
          </div>

          <div className="auth-input-wrap">
            <LockKeyhole size={18} />

            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
                setNotice("");
              }}
              required
            />

            <button
              type="button"
              className="auth-password-toggle"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        {/* VALIDATION ERROR */}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-error"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {/* INFORMATION MESSAGE */}

        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-notice"
            role="status"
          >
            {notice}
          </motion.p>
        )}

        {/* SIGN IN BUTTON */}

        <motion.button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
        >
          <span>{isSubmitting ? "Signing in?" : "Sign in"}</span>
          <ArrowRight size={18} />
        </motion.button>
      </form>

      {/* SIGNUP NAVIGATION */}

      <div className="auth-switch">
        <span>New to Quantara?</span>

        <Link to="/signup">
          Create an account
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* BOTTOM DIVIDER */}

      <div className="auth-form-divider">
        <span />

        <p>INTELLIGENCE STARTS HERE</p>

        <span />
      </div>

      {/* FOOTNOTE */}

      <p className="auth-form-footnote">
        Your data deserves a clearer perspective.
      </p>
    </AuthLayout>
  );
}