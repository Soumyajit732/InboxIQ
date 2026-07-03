export const getPriority = (p) => {
  if (p >= 4) return { label: "High",   cls: "pri-high",   dot: "#ef4444" };
  if (p === 3) return { label: "Medium", cls: "pri-medium", dot: "#f59e0b" };
  return             { label: "Low",    cls: "pri-low",    dot: "#10b981" };
};

export const formatDeadline = (deadline) => {
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

export const initials = (email) => email ? email.slice(0, 2).toUpperCase() : "?";

export const formatSyncTime = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 10)  return "just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
