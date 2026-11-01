import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Check,
  Database,
  Layers3,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import "./Auth.css";

type AuthLayoutProps = {
  children: ReactNode;
  mode: "login" | "signup";
};

const chartHeights = [38, 48, 42, 61, 53, 70, 63, 78, 72, 91];

export default function AuthLayout({
  children,
  mode,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      {/* LEFT SIDE — AUTHENTICATION FORM */}

      <div className="auth-left">
        <header className="auth-header">
          <Link to="/" className="auth-logo">
            <span className="auth-logo-icon">
              <Layers3 size={20} strokeWidth={2.1} />
            </span>

            <span>
              quantara<span className="auth-logo-dot">.</span>
            </span>
          </Link>

          <Link to="/" className="auth-back">
            <ArrowLeft size={15} />
            <span>Back to home</span>
          </Link>
        </header>

        <main className="auth-form-container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.65,
              ease: "easeOut",
            }}
            className="auth-form-content"
          >
            {children}
          </motion.div>
        </main>

        <footer className="auth-left-footer">
          <span>© {new Date().getFullYear()} QUANTARA</span>
          <span>Designed by Rutvi Landge</span>
        </footer>
      </div>

      {/* RIGHT SIDE — PREMIUM ANALYTICS VISUAL */}

      <aside className="auth-right">
        <div className="auth-right-grid" />

        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />

        <div className="auth-right-content">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="auth-right-heading"
          >
            <div className="auth-eyebrow">
              <Sparkles size={14} />
              INTELLIGENCE, REIMAGINED
            </div>

            <h2>
              Every question
              <br />
              leads to <em>clarity.</em>
            </h2>

            <p>
              {mode === "login"
                ? "Return to a workspace designed to turn complex data into meaningful understanding."
                : "A more intuitive way to explore, understand, and visualize the stories hidden in your data."}
            </p>
          </motion.div>

          {/* ANALYTICS PREVIEW */}

          <motion.div
            initial={{
              opacity: 0,
              y: 40,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.85,
              delay: 0.2,
              ease: "easeOut",
            }}
            className="auth-visual"
          >
            <div className="auth-preview">
              <div className="auth-preview-header">
                <div className="auth-preview-title">
                  <span className="auth-preview-icon">
                    <BarChart3 size={17} />
                  </span>

                  <div>
                    <strong>Analytics Overview</strong>
                    <small>Sample workspace</small>
                  </div>
                </div>

                <span className="auth-live-badge">
                  <span />
                  DEMO
                </span>
              </div>

              {/* METRIC CARDS */}

              <div className="auth-metrics">
                <div className="auth-metric">
                  <span>Total Revenue</span>
                  <strong>₹8.42L</strong>

                  <small>
                    <TrendingUp size={12} />
                    +18.6%
                  </small>
                </div>

                <div className="auth-metric">
                  <span>Growth Rate</span>
                  <strong>24.8%</strong>

                  <small>
                    <TrendingUp size={12} />
                    +4.1%
                  </small>
                </div>
              </div>

              {/* ANIMATED CHART */}

              <div className="auth-chart-card">
                <div className="auth-chart-header">
                  <div>
                    <strong>Revenue Performance</strong>
                    <small>
                      Illustrative monthly trends
                    </small>
                  </div>

                  <TrendingUp size={17} />
                </div>

                <div className="auth-chart">
                  {chartHeights.map((height, index) => (
                    <motion.div
                      key={index}
                      className="auth-chart-column"
                      initial={{ height: 0 }}
                      animate={{
                        height: `${height}%`,
                      }}
                      transition={{
                        duration: 0.75,
                        delay: 0.35 + index * 0.07,
                      }}
                    />
                  ))}
                </div>

                <div className="auth-chart-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                  <span>Jul</span>
                  <span>Sep</span>
                  <span>Dec</span>
                </div>
              </div>
            </div>

            {/* FLOATING AI CARD */}

            <motion.div
              className="auth-floating-card auth-floating-ai"
              animate={{
                y: [0, -9, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="auth-floating-icon">
                <BrainCircuit size={18} />
              </span>

              <div>
                <strong>AI Intelligence</strong>
                <small>Ask. Analyze. Understand.</small>
              </div>

              <Check
                size={15}
                className="auth-check"
              />
            </motion.div>

            {/* FLOATING DATASET CARD */}

            <motion.div
              className="auth-floating-card auth-floating-data"
              animate={{
                y: [0, 8, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="auth-floating-icon">
                <Database size={18} />
              </span>

              <div>
                <strong>Dataset Intelligence</strong>
                <small>500 sample records</small>
              </div>

              <ArrowUpRight size={15} />
            </motion.div>
          </motion.div>

          <div className="auth-right-bottom">
            <span>CONVERSATIONAL ANALYTICS</span>
            <span>QUANTARA / 2026</span>
          </div>
        </div>
      </aside>
    </div>
  );
}