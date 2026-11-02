import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { useToastStore } from "../store/useToastStore.js";
import { REACTIONS, formatTime, previewOf } from "../lib/format.js";
import Avatar, { colorFor } from "./Avatar.jsx";

// One chat bubble. Interactions (Telegram-style): click / right-click /
// tap a bubble to open its menu: quick reactions + Reply / Copy / Edit /
// Delete. Reactions render as chips under the text and toggle on click.
const MessageBubble = ({
  message,
  isOwn,
  isGroup,
  isFirstInRun,
  isLastInRun,
  seen,
  canDelete,
  onJumpTo,
  onMediaLoad,
}) => {
  const { setReplyingTo, setEditing, deleteMessage, reactToMessage } = useChatStore();
  const { authUser } = useAuthStore();
  const { addToast } = useToastStore();
  const [menu, setMenu] = useState(null);
  const bubbleRef = useRef(null);

  const sender = message.senderId;
  const deleted = message.isDeleted;
  const myReaction = message.reactions?.find((r) => r.userId === authUser._id)?.emoji;

  const openMenu = (e) => {
    if (deleted) return;
    if (e.type === "click") {
      if (e.target.closest("button, img, a")) return; // let those handle themselves
      if (window.getSelection()?.toString()) return; // user is selecting text
    } else {
      e.preventDefault(); // right-click
    }
    const r = bubbleRef.current.getBoundingClientRect();
    const room = window.innerHeight - r.bottom;
    setMenu({
      ...(room > 280 ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
      ...(isOwn
        ? { right: Math.max(8, window.innerWidth - r.right) }
        : { left: Math.max(8, r.left) }),
    });
  };
  const close = () => setMenu(null);

  // Group reactions into { emoji: count } for the chips.
  const counts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      addToast("Copied", "success");
    } catch {
      addToast("Couldn't copy");
    }
    close();
  };

  const remove = () => {
    close();
    if (window.confirm("Delete this message for everyone?")) deleteMessage(message);
  };

  const menuItem =
    "w-full text-left px-3 py-2 text-sm text-frost hover:bg-raised transition flex items-center gap-2";

  return (
    <div
      id={`msg-${message._id}`}
      className={`flex items-end gap-2 rounded-lg transition-shadow ${
        isOwn ? "justify-end" : "justify-start"
      } ${isFirstInRun ? "mt-3" : "mt-0.5"}`}
    >
      {isGroup && !isOwn && (
        <span className="w-7 shrink-0">
          {isLastInRun && <Avatar name={sender.fullName} src={sender.profilePic} size="sm" />}
        </span>
      )}

      <div
        ref={bubbleRef}
        onClick={openMenu}
        onContextMenu={openMenu}
        className={`max-w-[80%] sm:max-w-md px-3 py-1.5 text-sm cursor-pointer select-text ${
          isOwn ? "bg-signal text-ink" : "bg-raised text-frost"
        } ${
          isOwn
            ? `rounded-2xl ${isLastInRun ? "rounded-br-sm" : ""}`
            : `rounded-2xl ${isLastInRun ? "rounded-bl-sm" : ""}`
        }`}
      >
        {isGroup && !isOwn && isFirstInRun && (
          <p
            className="text-xs font-semibold mb-0.5 truncate"
            style={{ color: colorFor(sender.fullName) }}
          >
            {sender.fullName}
          </p>
        )}

        {message.replyTo && (
          <button
            type="button"
            onClick={() => onJumpTo(message.replyTo._id)}
            className={`block w-full text-left border-l-2 pl-2 pr-2 py-1 mb-1 rounded-sm text-xs ${
              isOwn ? "border-ink/60 bg-ink/10" : "border-signal bg-signal/10"
            }`}
          >
            <span className="block font-semibold truncate">
              {message.replyTo.senderId?.fullName || "Unknown"}
            </span>
            <span className="block truncate opacity-80">
              {previewOf(message.replyTo) || "Message"}
            </span>
          </button>
        )}

        {deleted ? (
          <p className="italic opacity-70 py-0.5">🚫 Message deleted</p>
        ) : (
          <>
            {message.image && (
              <img
                src={message.image}
                alt="attachment"
                loading="lazy"
                onLoad={onMediaLoad}
                onClick={() => window.open(message.image, "_blank", "noopener")}
                className="rounded-lg my-1 max-h-72 cursor-zoom-in"
              />
            )}
            {message.text && <p className="break-words whitespace-pre-wrap">{message.text}</p>}
          </>
        )}

        {Object.keys(counts).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(counts).map(([emoji, n]) => {
              const mine = myReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => reactToMessage(message._id, emoji)}
                  className={`px-1.5 py-0.5 rounded-full text-xs font-mono flex items-center gap-1 transition ${
                    isOwn
                      ? mine
                        ? "bg-ink text-signal"
                        : "bg-ink/15 text-ink"
                      : mine
                      ? "bg-signal text-ink"
                      : "bg-ink/60 text-frost"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <p
          className={`text-[10px] font-mono mt-0.5 flex items-center gap-1 justify-end ${
            isOwn ? "text-ink/60" : "text-mist"
          }`}
        >
          {message.editedAt && !deleted && <span>edited</span>}
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && !deleted && (
            <span
              className={seen ? "text-ink font-bold" : ""}
              title={seen ? "Read" : "Sent"}
            >
              {seen ? "✓✓" : "✓"}
            </span>
          )}
        </p>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
          <div
            className="fixed z-50 w-52 bg-panel border border-line rounded-xl shadow-2xl overflow-hidden"
            style={menu}
          >
            <div className="flex justify-between px-2 py-2 border-b border-line">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    reactToMessage(message._id, emoji);
                    close();
                  }}
                  className={`w-7 h-7 rounded-full text-base leading-none hover:bg-raised transition ${
                    myReaction === emoji ? "bg-signal/20 ring-1 ring-signal" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button className={menuItem} onClick={() => { setReplyingTo(message); close(); }}>
              ↩ Reply
            </button>
            {message.text && (
              <button className={menuItem} onClick={copy}>
                ⧉ Copy text
              </button>
            )}
            {isOwn && (
              <button className={menuItem} onClick={() => { setEditing(message); close(); }}>
                ✎ Edit
              </button>
            )}
            {canDelete && (
              <button className={`${menuItem} !text-danger`} onClick={remove}>
                🗑 Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MessageBubble;
