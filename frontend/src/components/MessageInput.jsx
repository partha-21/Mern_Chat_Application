import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore.js";
import { useToastStore } from "../store/useToastStore.js";
import { getSocket } from "../lib/socket.js";
import { previewOf } from "../lib/format.js";
import EmojiPicker from "./EmojiPicker.jsx";

// Keep in step with the backend's 10mb JSON limit (base64 adds ~33%).
const MAX_IMAGE_MB = 5;

// Remounted per chat (key=channel._id), so state resets when you switch.
const MessageInput = ({ channel }) => {
  const { sendMessage, editMessage, replyingTo, setReplyingTo, editing, setEditing } = useChatStore();
  const { addToast } = useToastStore();

  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const lastTypingEmit = useRef(0);
  const stopTimer = useRef(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  // Entering edit mode loads the message into the box.
  useEffect(() => {
    if (editing) {
      setText(editing.text || "");
      setImage(null);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        resize();
      });
    }
  }, [editing]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  // --- typing indicator: "typing" at most every 2s, "stopTyping" on idle ---
  const stopTyping = () => {
    clearTimeout(stopTimer.current);
    lastTypingEmit.current = 0;
    getSocket()?.emit("stopTyping", { channelId: channel._id });
  };
  const emitTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      socket.emit("typing", { channelId: channel._id });
      lastTypingEmit.current = now;
    }
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(stopTyping, 2500);
  };
  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    setText(e.target.value);
    resize();
    if (!editing) emitTyping();
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return addToast("That file isn't an image");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return addToast(`Image must be under ${MAX_IMAGE_MB}MB`);
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const cancelMode = () => {
    if (editing) {
      setEditing(null);
      setText("");
      requestAnimationFrame(resize);
    }
    if (replyingTo) setReplyingTo(null);
  };

  const submit = async () => {
    const value = text.trim();

    if (editing) {
      if (!value && !editing.image) return;
      if (value === (editing.text || "")) return cancelMode();
      if (await editMessage(editing._id, value)) {
        setText("");
        requestAnimationFrame(resize);
      }
      return;
    }

    if ((!value && !image) || sending) return;
    stopTyping();
    setSending(true);
    const ok = await sendMessage({ text: value, image });
    setSending(false);
    if (ok) {
      setText("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      requestAnimationFrame(resize);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      cancelMode();
    }
  };

  const banner = editing
    ? { label: "Editing message", body: previewOf(editing), icon: "✎" }
    : replyingTo
    ? { label: `Reply to ${replyingTo.senderId.fullName}`, body: previewOf(replyingTo), icon: "↩" }
    : null;

  return (
    <div className="border-t border-line bg-panel shrink-0">
      {banner && (
        <div className="flex items-center gap-2 px-3 pt-2">
          <span className="text-signal">{banner.icon}</span>
          <div className="flex-1 min-w-0 border-l-2 border-signal pl-2">
            <p className="text-xs font-semibold text-signal truncate">{banner.label}</p>
            <p className="text-xs text-mist truncate">{banner.body}</p>
          </div>
          <button onClick={cancelMode} className="text-mist hover:text-frost px-1" aria-label="Cancel">
            ✕
          </button>
        </div>
      )}

      {image && (
        <div className="px-3 pt-2 relative w-fit">
          <img src={image} alt="preview" className="h-20 rounded-lg" />
          <button
            type="button"
            onClick={() => {
              setImage(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="absolute top-0 right-1 bg-ink border border-line rounded-full w-5 h-5 text-xs text-frost"
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative flex items-end gap-1.5 p-3">
        {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}

        <button
          type="button"
          onClick={() => setEmojiOpen((o) => !o)}
          className="h-9 w-9 shrink-0 rounded-full text-lg text-mist hover:text-signal hover:bg-raised transition"
          title="Emoji"
        >
          ☺
        </button>
        <input type="file" accept="image/*" ref={fileRef} onChange={onFile} className="hidden" id="chat-image" />
        <label
          htmlFor="chat-image"
          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-lg transition ${
            editing ? "opacity-30 pointer-events-none" : "cursor-pointer text-mist hover:text-signal hover:bg-raised"
          }`}
          title="Attach image"
        >
          📎
        </label>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={editing ? "Edit your message…" : "Message"}
          className="flex-1 min-w-0 resize-none px-4 py-2 rounded-2xl bg-raised border border-line text-frost text-sm placeholder:text-mist focus:outline-none focus:border-signal max-h-36"
        />

        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="h-9 px-4 shrink-0 rounded-full bg-signal hover:bg-signal-dim disabled:opacity-50 text-ink text-sm font-semibold transition"
        >
          {editing ? "Save" : sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
