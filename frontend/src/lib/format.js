// Keep in sync with ALLOWED_REACTIONS in backend/src/utils/constants.js
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const pad = (n) => String(n).padStart(2, "0");
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (d) =>
  Math.round((startOfDay(new Date()) - startOfDay(new Date(d))) / 86400000);

export const formatTime = (d) => {
  const x = new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

export const isSameDay = (a, b) =>
  startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();

// Divider between days inside a conversation.
export const formatDayLabel = (d) => {
  const diff = dayDiff(d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const x = new Date(d);
  return x.toLocaleDateString([], {
    weekday: diff < 7 ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: x.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
};

// Timestamp in the chat list: time today, weekday this week, else date.
export const formatListTime = (d) => {
  const diff = dayDiff(d);
  if (diff === 0) return formatTime(d);
  if (diff < 7) return new Date(d).toLocaleDateString([], { weekday: "short" });
  return new Date(d).toLocaleDateString([], { day: "numeric", month: "short" });
};

export const formatLastSeen = (d) => {
  if (!d) return "last seen recently";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins} min ago`;
  const diff = dayDiff(d);
  if (diff === 0) return `last seen today at ${formatTime(d)}`;
  if (diff === 1) return `last seen yesterday at ${formatTime(d)}`;
  return `last seen ${new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })}`;
};

// One-line summary of a message (chat list, reply quotes).
export const previewOf = (m) => {
  if (!m) return "";
  if (m.isDeleted) return "Message deleted";
  if (m.image && !m.text) return "📷 Photo";
  return m.text;
};
