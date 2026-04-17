import { useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const LogoMark = () => (
  <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
    <rect x="2" y="2" width="12" height="12" rx="3" fill="white" />
    <rect x="18" y="2" width="12" height="12" rx="3" fill="white" opacity=".75" />
    <rect x="2" y="18" width="12" height="12" rx="3" fill="white" opacity=".75" />
    <rect x="18" y="18" width="12" height="12" rx="3" fill="white" opacity=".4" />
  </svg>
);

const RefreshIcon = ({ spinning }) => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
    style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="13" height="13" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ConfidenceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="13" height="13" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="12" height="12" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="48" height="48" stroke="#c7d2fe" strokeWidth="1.5">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const getPriority = (p) => {
  if (p >= 4) return { label: "High",   cls: "pri-high",   dot: "#ef4444" };
  if (p === 3) return { label: "Medium", cls: "pri-medium", dot: "#f59e0b" };
  return             { label: "Low",    cls: "pri-low",    dot: "#10b981" };
};

const formatDeadline = (deadline) => {
  if (!deadline) return { date: "No deadline", countdown: null, urgency: "" };
  const d = new Date(deadline);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const diffMs = d - Date.now();
  if (diffMs <= 0) return { date, countdown: "Expired", urgency: "expired" };
  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.floor((diffMs % 3600000) / 60000);
  let countdown;
  if (days > 0)           countdown = `${days}d ${hours}h left`;
  else if (totalHours > 0) countdown = `${totalHours}h ${mins}m left`;
  else                     countdown = `${mins}m left`;
  return { date, countdown, urgency: totalHours < 24 ? "urgent" : "ok" };
};

const initials = (email) => email ? email.slice(0, 2).toUpperCase() : "?";

const formatSyncTime = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 10)  return "just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// ── Sign-In Page ──────────────────────────────────────────────────────────────
function SignInPage() {
  const features = [
    { icon: <ZapIcon />,    text: "AI extracts tasks from your inbox automatically" },
    { icon: <MailIcon />,   text: "Works with Gmail — no manual input needed" },
    { icon: <ShieldIcon />, text: "Read-only access, your data stays private" },
  ];

  return (
    <div className="auth-shell">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo-box"><LogoMark /></div>
          <span className="auth-brand-name">InboxIQ</span>
        </div>
        <div className="auth-hero">
          <h1 className="auth-headline">Turn emails into<br />actionable tasks</h1>
          <p className="auth-desc">
            InboxIQ uses AI to read your Gmail and surface deadlines, priorities, and tasks — so nothing slips through the cracks.
          </p>
          <ul className="auth-features">
            {features.map((f, i) => (
              <li key={i} className="auth-feature-item">
                <span className="auth-feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-footer-text">© 2026 InboxIQ · Built with AI</p>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-sub">Sign in to access your task dashboard</p>
          </div>

          <a href={`${BACKEND_URL}/auth/login`} className="google-btn">
            <GoogleIcon />
            <span>Continue with Google</span>
          </a>

          <p className="auth-disclaimer">
            By continuing, you agree to allow InboxIQ to read your Gmail messages in read-only mode.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div className="stat-card" style={{ "--accent": accent }}>
      <div className="stat-top">
        <span className="stat-icon-wrap">{icon}</span>
      </div>
      <p className="stat-val">{value}</p>
      <p className="stat-lbl">{label}</p>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task }) {
  const pri = getPriority(task.priority);
  const { date, countdown, urgency } = formatDeadline(task.deadline);
  const confidence = typeof task.confidence === "number"
    ? Math.round(task.confidence * 100)
    : null;
  const gmailLink = task.thread_id
    ? `https://mail.google.com/mail/u/0/#inbox/${task.thread_id}`
    : null;

  return (
    <div className={`task-card ${pri.cls}`}>
      <div className="task-card-inner">
        <div className="task-top">
          <span className={`pri-badge ${pri.cls}`}>
            <span className="pri-dot" style={{ background: pri.dot }} />
            {pri.label}
          </span>
          {gmailLink && (
            <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="gmail-link" title="Open in Gmail">
              <ExternalLinkIcon /> Gmail
            </a>
          )}
        </div>

        <h3 className="task-title">{task.task || "Untitled Task"}</h3>

        {task.summary && <p className="task-body">{task.summary}</p>}

        <div className="task-meta-row">
          <span className="task-meta-item">
            <CalendarIcon />
            <span>{date}</span>
            {countdown && (
              <span className={`deadline-chip chip-${urgency}`}>{countdown}</span>
            )}
          </span>
          {confidence !== null && (
            <span className="task-meta-item confidence">
              <ConfidenceIcon />
              <span>{confidence}%</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="sk sk-badge" />
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line sk-line-short" />
      <div className="sk sk-footer" />
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onRefresh }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><InboxIcon /></div>
      <h3 className="empty-title">No tasks found</h3>
      <p className="empty-desc">We couldn't find any actionable tasks in your recent emails. Try refreshing to re-scan your inbox.</p>
      <button className="empty-refresh-btn" onClick={onRefresh}>Scan inbox</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "");
  const [token,     setToken]     = useState(() => localStorage.getItem("token") || "");
  const [lastSynced, setLastSynced] = useState(() => localStorage.getItem("lastSynced") || null);

  const isAuthenticated = !!token;

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setToken(""); setUserEmail(""); setTasks([]);
  };

  const fetchTasks = async () => {
    const t = localStorage.getItem("token");
    if (!t) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/gmail?token=${t}`);
      setTasks(res.data.tasks || []);
      const now = new Date().toISOString();
      localStorage.setItem("lastSynced", now);
      setLastSynced(now);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newToken = params.get("token");
    const newEmail = params.get("email");
    if (newToken) { localStorage.setItem("token", newToken); setToken(newToken); }
    if (newEmail) { localStorage.setItem("userEmail", newEmail); setUserEmail(newEmail); }
    if (newToken || newEmail) window.history.replaceState({}, "", "/");
  }, []);

  useEffect(() => { if (isAuthenticated) fetchTasks(); }, [isAuthenticated]);

  const highCount = tasks.filter(t => t.priority >= 4).length;
  const todayCount = tasks.filter(t => {
    const today = new Date().toDateString();
    return t.deadline && new Date(t.deadline).toDateString() === today;
  }).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #f1f5f9; color: #0f172a; -webkit-font-smoothing: antialiased;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        /* ══════════════════════════════════════════
           AUTH / SIGN-IN
        ══════════════════════════════════════════ */
        .auth-shell {
          display: flex; min-height: 100vh;
        }

        /* Left gradient panel */
        .auth-left {
          flex: 1; display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px 56px;
          background: linear-gradient(145deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%);
          color: white;
        }
        .auth-brand {
          display: flex; align-items: center; gap: 10px;
        }
        .auth-logo-box {
          width: 40px; height: 40px; background: rgba(255,255,255,.15);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .auth-brand-name {
          font-size: 20px; font-weight: 800; letter-spacing: -.3px;
        }
        .auth-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
        .auth-headline {
          font-size: 42px; font-weight: 800; line-height: 1.15;
          letter-spacing: -.5px; margin-bottom: 18px;
        }
        .auth-desc {
          font-size: 16px; color: #c7d2fe; line-height: 1.7; margin-bottom: 36px; max-width: 380px;
        }
        .auth-features { list-style: none; display: flex; flex-direction: column; gap: 16px; }
        .auth-feature-item {
          display: flex; align-items: center; gap: 14px;
          font-size: 15px; color: #e0e7ff;
        }
        .auth-feature-icon {
          width: 36px; height: 36px; background: rgba(255,255,255,.12);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .auth-footer-text { font-size: 13px; color: rgba(255,255,255,.4); }

        /* Right white panel */
        .auth-right {
          width: 480px; display: flex; align-items: center; justify-content: center;
          padding: 48px 40px; background: #fff;
        }
        .auth-card { width: 100%; max-width: 360px; }
        .auth-card-header { margin-bottom: 32px; }
        .auth-card-title { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 6px; letter-spacing: -.3px; }
        .auth-card-sub { font-size: 15px; color: #64748b; }

        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          width: 100%; padding: 14px 20px;
          background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 15px; font-weight: 600; color: #1e293b;
          text-decoration: none; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
          transition: all .18s ease;
        }
        .google-btn:hover {
          border-color: #6366f1; box-shadow: 0 4px 12px rgba(99,102,241,.15);
          transform: translateY(-1px);
        }
        .google-btn:active { transform: translateY(0); }

        .auth-disclaimer {
          margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;
        }

        /* Mobile auth */
        @media (max-width: 768px) {
          .auth-shell { flex-direction: column; }
          .auth-left { padding: 32px 28px; min-height: auto; }
          .auth-headline { font-size: 28px; }
          .auth-hero { padding: 24px 0; }
          .auth-right { width: 100%; padding: 40px 24px; }
        }

        /* ══════════════════════════════════════════
           DASHBOARD SHELL
        ══════════════════════════════════════════ */
        .dash { display: flex; flex-direction: column; min-height: 100vh; }

        /* ── Topbar ── */
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 60px;
          background: #fff; border-bottom: 1px solid #e2e8f0;
          position: sticky; top: 0; z-index: 20;
        }
        .topbar-brand { display: flex; align-items: center; gap: 10px; }
        .topbar-logo-box {
          width: 34px; height: 34px; background: #4f46e5;
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
        }
        .topbar-name { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -.2px; }

        .topbar-actions { display: flex; align-items: center; gap: 10px; }
        .last-synced {
          font-size: 12px; color: #94a3b8; font-weight: 500; white-space: nowrap;
        }

        .refresh-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 8px; border: 1px solid #e2e8f0;
          background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; color: #475569;
          transition: all .15s; white-space: nowrap;
        }
        .refresh-btn:hover { background: #f8fafc; border-color: #6366f1; color: #4f46e5; }

        .user-chip {
          display: flex; align-items: center; gap: 9px;
          padding: 5px 12px 5px 5px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 100px;
        }
        .user-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .user-email-text {
          font-size: 13px; font-weight: 500; color: #475569;
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .signout-btn {
          padding: 6px 12px; border-radius: 7px; border: none;
          background: transparent; font-size: 12px; font-weight: 600; color: #94a3b8;
          cursor: pointer; transition: all .15s;
        }
        .signout-btn:hover { background: #fee2e2; color: #ef4444; }

        /* ── Content ── */
        .content {
          flex: 1; padding: 32px 28px; max-width: 1200px; width: 100%; margin: 0 auto;
          animation: fadeUp .3s ease both;
        }

        .page-header { margin-bottom: 28px; }
        .page-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.3px; }
        .page-sub { font-size: 14px; color: #64748b; margin-top: 3px; }

        /* ── Stat Cards ── */
        .stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px;
        }
        .stat-card {
          background: #fff; border-radius: 16px; padding: 20px 22px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 1px 3px rgba(0,0,0,.04);
          position: relative; overflow: hidden;
          transition: box-shadow .2s, transform .2s;
        }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-2px); }
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: var(--accent);
        }
        .stat-top { margin-bottom: 14px; }
        .stat-icon-wrap {
          width: 40px; height: 40px; border-radius: 10px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--accent);
        }
        .stat-val { font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: -.5px; line-height: 1; margin-bottom: 4px; }
        .stat-lbl { font-size: 13px; color: #64748b; font-weight: 500; }

        /* ── Section ── */
        .section-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-title { font-size: 16px; font-weight: 700; color: #0f172a; }
        .section-count {
          font-size: 12px; font-weight: 600; color: #6366f1;
          background: #eef2ff; padding: 3px 10px; border-radius: 20px;
        }

        /* ── Task Grid ── */
        .tasks-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }

        /* ── Task Card ── */
        .task-card {
          background: #fff; border-radius: 14px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 1px 3px rgba(0,0,0,.04);
          overflow: hidden; transition: box-shadow .2s, transform .2s;
          position: relative;
        }
        .task-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.08); transform: translateY(-2px); }
        .task-card.pri-high::after {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:#ef4444;
        }
        .task-card.pri-medium::after {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:#f59e0b;
        }
        .task-card.pri-low::after {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:#10b981;
        }
        .task-card-inner { padding: 18px 18px 18px 22px; display: flex; flex-direction: column; gap: 10px; }

        .task-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

        .pri-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; padding: 3px 9px;
          border-radius: 20px; white-space: nowrap;
        }
        .pri-badge.pri-high   { background: #fef2f2; color: #dc2626; }
        .pri-badge.pri-medium { background: #fffbeb; color: #d97706; }
        .pri-badge.pri-low    { background: #f0fdf4; color: #16a34a; }
        .pri-dot { width: 6px; height: 6px; border-radius: 50%; }

        .gmail-link {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 600; color: #6366f1;
          text-decoration: none; padding: 3px 8px; border-radius: 6px;
          background: #eef2ff; transition: background .15s;
          white-space: nowrap;
        }
        .gmail-link:hover { background: #e0e7ff; }

        .task-title {
          font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.4;
        }
        .task-body {
          font-size: 13px; color: #64748b; line-height: 1.55;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .task-meta-row {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px; border-top: 1px solid #f8fafc;
          flex-wrap: wrap; gap: 6px;
        }
        .task-meta-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: #94a3b8; flex-wrap: wrap;
        }
        .task-meta-item.confidence { color: #6366f1; font-weight: 600; }

        .deadline-chip {
          font-size: 10px; font-weight: 700; padding: 2px 7px;
          border-radius: 20px; white-space: nowrap;
        }
        .chip-ok      { background: #f0fdf4; color: #16a34a; }
        .chip-urgent  { background: #fff7ed; color: #c2410c; }
        .chip-expired { background: #fef2f2; color: #dc2626; }

        /* ── Skeleton ── */
        .skeleton-card {
          background: #fff; border-radius: 14px; padding: 18px 22px;
          border: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 10px;
        }
        .sk {
          border-radius: 6px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 400px 100%; animation: shimmer 1.4s infinite;
        }
        .sk-badge  { height: 22px; width: 60px; }
        .sk-title  { height: 18px; width: 75%; }
        .sk-line   { height: 13px; width: 90%; }
        .sk-line-short { width: 65%; }
        .sk-footer { height: 12px; width: 50%; margin-top: 4px; }

        /* ── Empty State ── */
        .empty-state {
          text-align: center; padding: 64px 24px; display: flex;
          flex-direction: column; align-items: center; gap: 12px;
          grid-column: 1 / -1;
        }
        .empty-icon {
          width: 80px; height: 80px; background: #eef2ff; border-radius: 20px;
          display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
        }
        .empty-title { font-size: 17px; font-weight: 700; color: #1e293b; }
        .empty-desc  { font-size: 14px; color: #64748b; max-width: 340px; line-height: 1.6; }
        .empty-refresh-btn {
          margin-top: 8px; padding: 10px 24px; border-radius: 9px;
          background: #4f46e5; color: white; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: background .15s, transform .15s;
        }
        .empty-refresh-btn:hover { background: #4338ca; transform: translateY(-1px); }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .content { padding: 24px 20px; }
        }
        @media (max-width: 640px) {
          .stats-row {
            display: flex; overflow-x: auto; gap: 12px;
            padding-bottom: 6px; scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .stats-row::-webkit-scrollbar { display: none; }
          .stat-card { min-width: 200px; scroll-snap-align: start; flex-shrink: 0; }
          .tasks-grid { grid-template-columns: 1fr; }
          .topbar { padding: 0 16px; }
          .content { padding: 20px 16px; }
          .user-email-text { display: none; }
          .last-synced { display: none; }
          .topbar-name { font-size: 15px; }
          .refresh-btn span { display: none; }
          .refresh-btn { padding: 8px; }
        }
        @media (max-width: 400px) {
          .stat-val { font-size: 26px; }
          .auth-headline { font-size: 24px; }
        }
      `}</style>

      {!isAuthenticated ? (
        <SignInPage />
      ) : (
        <div className="dash">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-brand">
              <div className="topbar-logo-box"><LogoMark /></div>
              <span className="topbar-name">InboxIQ</span>
            </div>
            <div className="topbar-actions">
              {lastSynced && !loading && (
                <span className="last-synced">
                  Synced {formatSyncTime(lastSynced)}
                </span>
              )}
              <button className="refresh-btn" onClick={fetchTasks} disabled={loading}>
                <RefreshIcon spinning={loading} />
                <span>Refresh</span>
              </button>
              <div className="user-chip">
                <div className="user-avatar">{initials(userEmail)}</div>
                {userEmail && <span className="user-email-text">{userEmail}</span>}
                <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="content">
            <div className="page-header">
              <h1 className="page-title">Task Dashboard</h1>
              <p className="page-sub">AI-extracted tasks from your Gmail inbox</p>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <StatCard label="Total Tasks"   value={tasks.length}  icon={<CheckIcon />}    accent="#6366f1" />
              <StatCard label="High Priority" value={highCount}      icon={<ZapIcon />}      accent="#ef4444" />
              <StatCard label="Due Today"     value={todayCount}     icon={<CalendarIcon />} accent="#f59e0b" />
            </div>

            {/* Task list */}
            <div className="section-head">
              <h2 className="section-title">Your Tasks</h2>
              {!loading && tasks.length > 0 && (
                <span className="section-count">{tasks.length} tasks</span>
              )}
            </div>

            <div className="tasks-grid">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              ) : tasks.length === 0 ? (
                <EmptyState onRefresh={fetchTasks} />
              ) : (
                tasks.map((task, i) => <TaskCard key={i} task={task} />)
              )}
            </div>
          </main>
        </div>
      )}
    </>
  );
}
