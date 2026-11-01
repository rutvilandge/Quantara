import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";

import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import { signup, ApiError } from "../lib/api";

// ======================================================
// QUANTARA — PREMIUM SIGNUP PAGE
// ======================================================

// ======================================================
// PASSWORD STRENGTH
// ======================================================

function getPasswordStrength(password: string): number {
  let score = 0;

  if (password.length >= 8) {
    score++;
  }

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score++;
  }

  if (/[0-9]/.test(password)) {
    score++;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  }

  return score;
}

// ======================================================
// SIGNUP COMPONENT
// ======================================================

export default function Signup() {
  const navigate = useNavigate();

  // ====================================================
  // FORM STATE
  // ====================================================

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ====================================================
  // PASSWORD STRENGTH
  // ====================================================

  const strength = getPasswordStrength(password);

  const requirements = [
    {
      label: "At least 8 characters",
      valid: password.length >= 8,
    },
    {
      label: "Uppercase and lowercase letters",
      valid:
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password),
    },
    {
      label: "At least one number",
      valid: /[0-9]/.test(password),
    },
    {
      label: "At least one special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];

  // ====================================================
  // CLEAR MESSAGES
  // ====================================================

  function clearMessages() {
    setError("");
    setNotice("");
  }

  // ====================================================
  // REAL SIGNUP SUBMISSION
  // ====================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearMessages();

    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    // --------------------------------------------------
    // FULL NAME VALIDATION
    // --------------------------------------------------

    if (
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      setError(
        "Full name must be between 2 and 100 characters."
      );
      return;
    }

    // --------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (normalizedEmail.length > 255) {
      setError("Email address is too long.");
      return;
    }

    // --------------------------------------------------
    // PASSWORD VALIDATION
    // --------------------------------------------------

    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError(
        "Password must be at least 8 characters and at most 72 UTF-8 bytes."
      );
      return;
    }

    if (strength < 4) {
      setError(
        "Please choose a password that meets all requirements."
      );
      return;
    }

    // --------------------------------------------------
    // CONFIRM PASSWORD
    // --------------------------------------------------

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // --------------------------------------------------
    // REGISTER USER WITH SPRING BOOT
    // --------------------------------------------------

    setIsSubmitting(true);

    try {
      const response = await signup({
        fullName: name.trim(),
        email: normalizedEmail,
        password,
      });

      // Registration succeeded.
      // Do not automatically authenticate the user.

      setNotice(response.message);

      // Clear sensitive password fields.
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after successful registration.
      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            message:
              "Your account has been created successfully. Please sign in.",
          },
        });
      }, 1200);
    } catch (err: unknown) {
      // ------------------------------------------------
      // HANDLE API ERRORS
      // ------------------------------------------------

      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(
            "An account with this email already exists. Please sign in."
          );
        } else if (err.status === 400) {
          setError(
            "Please check your details and try again."
          );
        } else if (err.status === 403) {
          setError(
            "Security verification failed. Please try again."
          );
        } else if (err.status >= 500) {
          setError(
            "Our servers are temporarily unavailable. Please try again."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(
          "Unable to connect to QUANTARA. Please check your connection and try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ====================================================
  // SIGNUP UI
  // ====================================================

  return (
    <AuthLayout mode="signup">
      {/* PAGE HEADING */}

      <div className="auth-form-top">
        <span className="auth-section-label">
          <Sparkles size={14} />
          BEGIN WITH CURIOSITY
        </span>

        <h1>
          A clearer <em>perspective.</em>
        </h1>

        <p>
          Create your workspace and discover a more
          intelligent way to understand data.
        </p>
      </div>

      {/* SIGNUP FORM */}

      <form
        onSubmit={handleSubmit}
        className="auth-form auth-signup-form"
        noValidate
      >
        {/* FULL NAME */}

        <div className="auth-field">
          <label htmlFor="signup-name">
            Full name
          </label>

          <div className="auth-input-wrap">
            <UserRound size={18} />

            <input
              id="signup-name"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              maxLength={100}
              value={name}
              disabled={isSubmitting}
              onChange={(event) => {
                setName(event.target.value);
                clearMessages();
              }}
              required
            />
          </div>
        </div>

        {/* EMAIL ADDRESS */}

        <div className="auth-field">
          <label htmlFor="signup-email">
            Email address
          </label>

          <div className="auth-input-wrap">
            <Mail size={18} />

            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={255}
              value={email}
              disabled={isSubmitting}
              onChange={(event) => {
                setEmail(event.target.value);
                clearMessages();
              }}
              required
            />
          </div>
        </div>

        {/* PASSWORD */}

        <div className="auth-field">
          <label htmlFor="signup-password">
            Password
          </label>

          <div className="auth-input-wrap">
            <LockKeyhole size={18} />

            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              autoComplete="new-password"
              maxLength={128}
              value={password}
              disabled={isSubmitting}
              onChange={(event) => {
                setPassword(event.target.value);
                clearMessages();
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

          {/* PASSWORD STRENGTH */}

          {password.length > 0 && (
            <div className="auth-strength">
              <div className="auth-strength-bars">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={
                      level <= strength
                        ? `active strength-${strength}`
                        : ""
                    }
                  />
                ))}
              </div>

              <p>
                {strength <= 1
                  ? "Weak password"
                  : strength === 2
                    ? "Fair password"
                    : strength === 3
                      ? "Good password"
                      : "Strong password"}
              </p>
            </div>
          )}

          {/* PASSWORD REQUIREMENTS */}

          <div className="auth-requirements">
            {requirements.map((requirement) => (
              <span
                key={requirement.label}
                className={
                  requirement.valid ? "valid" : ""
                }
              >
                <Check size={12} />
                {requirement.label}
              </span>
            ))}
          </div>
        </div>

        {/* CONFIRM PASSWORD */}

        <div className="auth-field">
          <label htmlFor="signup-confirm">
            Confirm password
          </label>

          <div className="auth-input-wrap">
            <LockKeyhole size={18} />

            <input
              id="signup-confirm"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
              maxLength={128}
              value={confirmPassword}
              disabled={isSubmitting}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearMessages();
              }}
              required
            />

            <button
              type="button"
              className="auth-password-toggle"
              onClick={() =>
                setShowConfirmPassword(
                  (previous) => !previous
                )
              }
              aria-label={
                showConfirmPassword
                  ? "Hide password"
                  : "Show password"
              }
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}

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

        {/* SUCCESS MESSAGE */}

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

        {/* CREATE ACCOUNT BUTTON */}

        <motion.button
          type="submit"
          className="auth-submit"
          whileHover={
            isSubmitting ? undefined : { y: -2 }
          }
          whileTap={
            isSubmitting
              ? undefined
              : { scale: 0.99 }
          }
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span>
            {isSubmitting
              ? "Creating your account..."
              : "Create account"}
          </span>

          <ArrowRight size={18} />
        </motion.button>
      </form>

      {/* LOGIN NAVIGATION */}

      <div className="auth-switch">
        <span>Already have an account?</span>

        <Link to="/login">
          Sign in
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* FOOTNOTE */}

      <p className="auth-form-footnote">
        Intelligence begins with a question.
      </p>
    </AuthLayout>
  );
}