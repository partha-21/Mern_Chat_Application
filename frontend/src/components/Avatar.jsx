// Shared avatar: shows the user's uploaded photo when present, otherwise
// falls back to initials on a deterministic color. An optional "live
// signal" presence ring is layered on top — the app's signature motif.
const PALETTE = [
  "#FFB454", "#4FD1C5", "#8B9CFF", "#F2789F", "#63C77B", "#E0A96D",
];

export const colorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const SIZES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-20 h-20 text-2xl",
};

const Avatar = ({ name, src, online = false, size = "md" }) => {
  const bg = colorFor(name);

  return (
    <span className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${SIZES[size]} rounded-full object-cover`}
        />
      ) : (
        <span
          className={`${SIZES[size]} rounded-full flex items-center justify-center font-display font-semibold text-ink`}
          style={{ backgroundColor: bg }}
        >
          {name?.charAt(0)?.toUpperCase() || "?"}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-signal" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal ring-2 ring-panel" />
          </span>
        </span>
      )}
    </span>
  );
};

export default Avatar;
