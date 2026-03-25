import { useEffect, useState } from "react";
import axios from "axios";

// ── Icons (inline SVGs, no extra deps) ───────────────────────────────────────
const Icons = {
  Logo: () => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="white" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="white" opacity=".7" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="white" opacity=".7" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="white" opacity=".4" />
    </svg>
  ),
  Dashboard: ({ active }) => (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke={active ? "#3b5bdb" : "#888"} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="#555" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="#aaa" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  TrendUp: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="#aaa" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  CheckSquare: () => (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22" stroke="#3b5bdb" strokeWidth="2">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22" stroke="#e03131" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22" stroke="#2f9e44" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Help: () => (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="white" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="#555" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="#555" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getPriorityLabel = (priority) => {
  if (priority >= 4) return { label: "High", cls: "priority-high" };
  if (priority === 3) return { label: "Medium", cls: "priority-medium" };
  return { label: "Low", cls: "priority-low" };
};

const formatDeadline = (deadline) => {
  if (!deadline) return { date: "No deadline", countdown: null, chipCls: "" };
  const d = new Date(deadline);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const diffMs = d - Date.now();
  if (diffMs <= 0) return { date, countdown: "Expired", chipCls: "chip-expired" };
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours   = Math.floor(diffMs / 3600000);
  const days         = Math.floor(totalHours / 24);
  const hours        = totalHours % 24;
  const minutes      = totalMinutes % 60;
  let countdown;
  if (days > 0)           countdown = `${days}d ${hours}h left`;
  else if (totalHours > 0) countdown = `${totalHours}h ${minutes}m left`;
  else                     countdown = `${totalMinutes}m left`;
  const chipCls = totalHours < 24 ? "chip-urgent" : "chip-ok";
  return { date, countdown, chipCls };
};

const getHighPriorityCount = (tasks) => tasks.filter((t) => t.priority >= 4).length;
const getDueTodayCount = (tasks) => {
  const today = new Date().toDateString();
  return tasks.filter((t) => t.deadline && new Date(t.deadline).toDateString() === today).length;
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task }) {
  const priority = getPriorityLabel(task.priority);
  const confidencePct =
    typeof task.confidence === "number"
      ? `${Math.round(task.confidence * 100)}% confidence`
      : task.confidence || "—";
  const { date, countdown, chipCls } = formatDeadline(task.deadline);
  const gmailLink = task.thread_id
    ? `https://mail.google.com/mail/u/0/#inbox/${task.thread_id}`
    : null;

  return (
    <div className="task-card">
      <div className="task-header">
        <h3 className="task-title">{task.task || "Untitled Task"}</h3>
        <span className={`priority-badge ${priority.cls}`}>{priority.label}</span>
      </div>
      <p className="task-summary">{task.summary}</p>
      <div className="task-footer">
        <span className="task-meta">
          <Icons.Calendar />
          {date}
          {countdown && <span className={`chip ${chipCls}`}>{countdown}</span>}
        </span>
        <span className="task-meta">
          <Icons.TrendUp />
          {confidencePct}
        </span>
      </div>
      {gmailLink && (
        <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="gmail-btn">
          Open in Gmail
        </a>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, isOpen, onClose }) {
  const links = [
    { id: "dashboard", label: "Dashboard", Icon: Icons.Dashboard },
  ];
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-box"><Icons.Logo /></div>
          <span className="logo-text">InboxIQ</span>
          {/* Close button visible only on mobile */}
          <button className="sidebar-close-btn" onClick={onClose} title="Close menu">
            <Icons.Close />
          </button>
        </div>
        <nav className="sidebar-nav">
          {links.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${active === id ? "nav-active" : ""}`}
              onClick={() => { setActive(id); onClose(); }}
            >
              <Icon active={active === id} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [menuOpen,  setMenuOpen]  = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/gmail");
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f4f5f7; color: #1a1a2e;
        }

        /* ── Layout ── */
        .app { display: flex; min-height: 100vh; }

        /* ── Backdrop ── */
        .sidebar-backdrop {
          display: none;
          position: fixed; inset: 0; background: rgba(0,0,0,.35);
          z-index: 99; backdrop-filter: blur(2px);
        }
        .app-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        /* ── Sidebar ── */
        .sidebar {
          width: 220px; min-height: 100vh; background: #fff;
          border-right: 1px solid #e8eaed; padding: 24px 16px;
          display: flex; flex-direction: column; gap: 32px;
          position: sticky; top: 0; height: 100vh;
          flex-shrink: 0;
        }
        .sidebar-logo {
          display: flex; align-items: center; gap: 10px; padding: 0 4px;
        }
        .logo-box {
          width: 36px; height: 36px; background: #3b5bdb; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .logo-text { font-size: 17px; font-weight: 700; color: #1a1a2e; flex: 1; }
        .sidebar-close-btn {
          display: none; border: none; background: transparent;
          cursor: pointer; padding: 4px; border-radius: 6px;
          align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          border-radius: 8px; border: none; background: transparent;
          cursor: pointer; font-size: 14px; font-weight: 500; color: #555;
          text-align: left; width: 100%; transition: background .15s;
          min-height: 44px; /* touch target */
        }
        .nav-item:hover { background: #f0f2ff; color: #3b5bdb; }
        .nav-active { background: #edf0ff !important; color: #3b5bdb !important; font-weight: 600; }

        /* ── Main ── */
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; gap: 12px;
          border-bottom: 1px solid #e8eaed; background: #fff;
          position: sticky; top: 0; z-index: 10;
        }
        .topbar-left { display: flex; align-items: center; gap: 10px; }
        .topbar-right { display: flex; align-items: center; gap: 10px; }

        /* Hamburger — hidden on desktop */
        .menu-btn {
          display: none; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 8px; border: 1px solid #e8eaed;
          background: #fff; cursor: pointer;
        }

        .refresh-btn {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e8eaed;
          background: #fff; cursor: pointer; transition: background .15s;
        }
        .refresh-btn:hover { background: #f0f2ff; }
        .avatar {
          width: 36px; height: 36px; border-radius: 50%; background: #ccc;
          overflow: hidden; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* ── Content ── */
        .content { padding: 28px 32px; flex: 1; }
        .page-title { font-size: 26px; font-weight: 700; color: #1a1a2e; }
        .page-subtitle { font-size: 14px; color: #888; margin-top: 4px; margin-bottom: 28px; }

/* ── Stats Row (Responsive Grid) ───────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* desktop default */
  gap: 16px;
  margin-bottom: 24px;
}

/* ── Stat Card ───────────────── */
.stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  box-shadow: 0 1px 4px rgba(0,0,0,.06);

  min-width: 0; /* 🔥 prevents overflow */
}

/* ── Text ───────────────── */
.stat-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
}

/* ── Icon ───────────────── */
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #f0f2ff;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;
}

/* ── Tablet (≤ 900px) ───────────────── */
@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

/* ── Mobile (≤ 600px) ───────────────── */
@media (max-width: 600px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr); /* 🔥 keep 3 in row */
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
    border-radius: 12px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
  }
}

/* ── Small Mobile (≤ 400px) ───────────────── */
@media (max-width: 400px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr); /* fallback */
  }
}

        /* ── Task Section ── */
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
        }
        .section-title { font-size: 18px; font-weight: 700; color: #1a1a2e; }
        .section-count { font-size: 13px; color: #888; }
        .tasks-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

        /* ── Task Card ── */
        .task-card {
          background: #fff; border-radius: 14px; padding: 18px;
          box-shadow: 0 1px 4px rgba(0,0,0,.06);
          display: flex; flex-direction: column; gap: 10px;
          transition: box-shadow .2s;
        }
        .task-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }
        .task-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .task-title { font-size: 15px; font-weight: 700; color: #1a1a2e; line-height: 1.35; }
        .task-summary {
          font-size: 13px; color: #666; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .task-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 8px; border-top: 1px solid #f0f0f0;
          flex-wrap: wrap; gap: 6px;
        }
        .task-meta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #aaa; flex-wrap: wrap; }

        .gmail-btn {
          margin-top: 6px; display: inline-block; font-size: 12px; font-weight: 600;
          color: #3b5bdb; background: #edf0ff; padding: 7px 12px;
          border-radius: 6px; text-decoration: none; transition: background .2s;
          /* Full width on mobile for easier tapping */
        }
        .gmail-btn:hover { background: #dbe0ff; }

        /* ── Countdown chips ── */
        .chip {
          display: inline-flex; align-items: center;
          font-size: 10px; font-weight: 700; padding: 2px 8px;
          border-radius: 20px; margin-left: 4px; letter-spacing: .2px; white-space: nowrap;
        }
        .chip-ok      { background: #f0fff4; color: #2f9e44; }
        .chip-urgent  { background: #fff3e0; color: #e67700; }
        .chip-expired { background: #fff0f0; color: #e03131; }

        /* ── Priority Badges ── */
        .priority-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px;
          border-radius: 20px; white-space: nowrap; flex-shrink: 0;
        }
        .priority-high   { background: #fff0f0; color: #e03131; }
        .priority-medium { background: #fff8e1; color: #e67700; }
        .priority-low    { background: #f0fff4; color: #2f9e44; }

        /* ── Loading ── */
        .loading { text-align: center; color: #888; padding: 40px; font-size: 14px; }

        /* ── Help Button ── */
        .help-btn {
          position: fixed; bottom: 24px; right: 24px;
          width: 44px; height: 44px; border-radius: 50%;
          background: #1a1a2e; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,.2);
          z-index: 50;
        }

        /* ════════════════════════════════════════════
           TABLET  (≤ 900px) — 2-col stats → 3 cols OK
           but tasks drop to 1 col early
        ════════════════════════════════════════════ */
        @media (max-width: 900px) {
          .sidebar { width: 200px; }
          .content { padding: 24px 20px; }
        }

        /* ════════════════════════════════════════════
           MOBILE  (< 768px)
        ════════════════════════════════════════════ */
        @media (max-width: 767px) {
          /* Show backdrop when menu open */
          .sidebar-backdrop { display: block; }

          /* Sidebar slides in from left */
          .sidebar {
            position: fixed; top: 0; left: 0; bottom: 0;
            width: 260px; height: 100vh;
            transform: translateX(-100%);
            transition: transform .25s ease;
            z-index: 100; box-shadow: 4px 0 24px rgba(0,0,0,.12);
          }
          .sidebar.sidebar-open { transform: translateX(0); }
          .sidebar-close-btn { display: flex; }

          /* Hamburger shows on mobile */
          .menu-btn { display: flex; }

          /* Topbar: logo in center area on mobile */
          .topbar { padding: 10px 16px; }

          /* Content */
          .content { padding: 20px 16px; }
          .page-title { font-size: 22px; }
          .page-subtitle { font-size: 13px; margin-bottom: 20px; }

          /* Stats: 1 column */
/* 🔥 Stats: horizontal scroll (mobile upgrade) */
/* 🔥 FIXED horizontal stats layout */
.stats-row {
  display: flex;
  overflow-x: auto;
  gap: 12px;

  padding: 0 4px 8px 4px;   /* 🔥 IMPORTANT (fix edge cut) */
  margin: 0 -4px 24px -4px; /* align with content edges */

  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbar */
.stats-row::-webkit-scrollbar {
  display: none;
}

/* Cards */
.stat-card {
  min-width: 260px;   /* 🔥 increased for proper spacing */
  flex-shrink: 0;

  scroll-snap-align: start;

  background: #fff;
  border-radius: 14px;
}
          .stat-value { font-size: 32px; }

          /* Tasks: 1 column */
          .tasks-grid { grid-template-columns: 1fr; gap: 12px; }

          /* Gmail button full-width */
          .gmail-btn { display: block; text-align: center; }

          /* Help button smaller on mobile */
          .help-btn { bottom: 16px; right: 16px; width: 40px; height: 40px; }

          
        }

        /* ════════════════════════════════════════════
           SMALL MOBILE  (< 400px)
        ════════════════════════════════════════════ */
        @media (max-width: 399px) {
          .page-title { font-size: 19px; }
          .stat-value { font-size: 26px; }
          .task-title { font-size: 14px; }
        }
      `}</style>

      <div className="app">
        {/* <Sidebar
          active={activeNav}
          setActive={setActiveNav}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        /> */}

        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-left">
              <div className="app-logo">
                <div className="logo-box"><Icons.Logo /></div>
                <span className="logo-text">InboxIQ</span>
              </div>
            </div>

            <div className="topbar-right">
              <button
                className="refresh-btn"
                onClick={fetchTasks}
                title="Refresh"
              >
                <Icons.Refresh />
              </button>
            </div>
          </div>

          {/* Page Content */}
          <div className="content">
            {/* <h1 className="page-title">InboxIQ</h1> */}
            {/* <p className="page-subtitle">AI-powered task extraction from your emails</p> */}

            {/* Stats */}
            <div className="stats-row">
              <StatCard label="Total Tasks"         value={tasks.length}               icon={<Icons.CheckSquare />} />
              <StatCard label="High Priority"        value={getHighPriorityCount(tasks)} icon={<Icons.AlertCircle />} />
              <StatCard label="Due Today"            value={getDueTodayCount(tasks)}     icon={<Icons.Clock />}       />
            </div>

            {/* Tasks */}
            <div className="section-header">
              <h2 className="section-title">Your Tasks</h2>
              <span className="section-count">{tasks.length} total tasks</span>
            </div>

            {loading && <p className="loading">Loading tasks…</p>}

            {!loading && tasks.length === 0 && (
              <p className="loading">No tasks found. Tap refresh to fetch from Gmail.</p>
            )}

            {!loading && tasks.length > 0 && (
              <div className="tasks-grid">
                {tasks.map((task, i) => <TaskCard key={i} task={task} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* <button className="help-btn" title="Help" aria-label="Help"><Icons.Help /></button> */}
    </>
  );
}
