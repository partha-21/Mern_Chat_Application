import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { useToastStore } from "../store/useToastStore.js";
import { formatDayLabel, formatLastSeen, isSameDay } from "../lib/format.js";
import Avatar from "./Avatar.jsx";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";

const RUN_GAP_MS = 5 * 60 * 1000; // same sender within 5 min = one visual "run"

const ChatContainer = () => {
  const channel = useChatStore((s) => s.channels.find((c) => c._id === s.selectedChannelId));
  const {
    messages, isMessagesLoading, isLoadingOlder, hasMore, loadOlderMessages,
    typing, lastSeen, selectChannel, setInfoOpen, infoOpen,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { addToast } = useToastStore();

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const stickToBottom = useRef(true);
  const prevLastId = useRef(null);
  const pendingPrepend = useRef(null);
  const [showJump, setShowJump] = useState(false);

  // New chat opened -> forget scroll state so we snap to the bottom.
  useEffect(() => {
    prevLastId.current = null;
    stickToBottom.current = true;
    setShowJump(false);
  }, [channel?._id]);

  // Scroll policy:
  //  - older page prepended  -> keep the viewport anchored (no jump)
  //  - first load of a chat  -> instantly to the bottom
  //  - new message at bottom -> follow it only if you were already at the
  //    bottom, or you sent it (never yank someone reading history)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingPrepend.current != null) {
      el.scrollTop = el.scrollHeight - pendingPrepend.current;
      pendingPrepend.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    if (!last || last._id === prevLastId.current) return;

    const first = prevLastId.current === null;
    const mine = last.senderId._id === authUser._id;
    if (first || mine || stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth" });
    }
    prevLastId.current = last._id;
  }, [messages, authUser._id]);

  const handleScroll = async () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottom.current = nearBottom;
    setShowJump(!nearBottom);

    if (el.scrollTop < 60 && hasMore && !isLoadingOlder && messages.length > 0) {
      pendingPrepend.current = el.scrollHeight;
      const n = await loadOlderMessages();
      if (n === 0) pendingPrepend.current = null;
    }
  };

  const jumpToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  // Images change the layout height after they load.
  const onMediaLoad = () => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  };

  const jumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return addToast("That message is further up — scroll to load it");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("bg-signal/10");
    setTimeout(() => el.classList.remove("bg-signal/10"), 1200);
  };

  if (!channel) return null;

  const isGroup = channel.type === "group";
  const other = isGroup ? null : channel.members.find((m) => m._id !== authUser._id);
  const title = isGroup ? channel.name : other?.fullName || "Unknown";
  const isAdmin = channel.admins?.includes(authUser._id);
  const typers = Object.values(typing[channel._id] || {});

  let status;
  if (typers.length) {
    status = (
      <span className="text-signal animate-blink">
        {isGroup ? `${typers.slice(0, 2).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…` : "typing…"}
      </span>
    );
  } else if (isGroup) {
    const online = channel.members.filter((m) => onlineUsers.includes(m._id)).length;
    status = `${channel.members.length} members, ${online} online`;
  } else if (onlineUsers.includes(other?._id)) {
    status = <span className="text-signal">online</span>;
  } else {
    status = formatLastSeen(lastSeen[other?._id] ?? other?.lastSeen);
  }

  // Read = at least one OTHER member has seen it (✓✓).
  const isSeen = (m) =>
    channel.members.some((mem) => mem._id !== authUser._id && m.seenBy?.includes(mem._id));

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <div className="px-3 py-2.5 border-b border-line bg-panel shrink-0 flex items-center gap-3">
        <button
          onClick={() => selectChannel(null)}
          className="md:hidden text-mist hover:text-frost px-1 text-lg"
          aria-label="Back to chats"
        >
          ←
        </button>
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
          title="Chat info"
        >
          <Avatar
            name={title}
            src={other?.profilePic}
            online={other ? onlineUsers.includes(other._id) : false}
          />
          <span className="min-w-0">
            <span className="block font-display font-medium text-frost text-sm truncate">{title}</span>
            <span className="block text-[11px] font-mono text-mist truncate">{status}</span>
          </span>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto px-3 sm:px-4 py-3">
          {isLoadingOlder && (
            <p className="text-center text-[11px] font-mono text-mist py-1">loading earlier messages…</p>
          )}
          {!hasMore && messages.length > 0 && !isMessagesLoading && (
            <p className="text-center text-[11px] font-mono text-mist/60 py-1">— start of conversation —</p>
          )}

          {isMessagesLoading ? (
            <p className="text-mist text-sm font-mono">loading log…</p>
          ) : messages.length === 0 ? (
            <p className="text-mist text-sm text-center mt-10">No messages here yet. Say hi 👋</p>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const sameRun = (a, b) =>
                a &&
                b &&
                a.senderId._id === b.senderId._id &&
                isSameDay(a.createdAt, b.createdAt) &&
                Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < RUN_GAP_MS;
              const isOwn = m.senderId._id === authUser._id;

              return (
                <div key={m._id}>
                  {newDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] font-mono text-mist bg-raised px-3 py-1 rounded-full">
                        {formatDayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={m}
                    isOwn={isOwn}
                    isGroup={isGroup}
                    isFirstInRun={newDay || !sameRun(prev, m)}
                    isLastInRun={!sameRun(m, next)}
                    seen={isOwn && isSeen(m)}
                    canDelete={isOwn || (isGroup && isAdmin)}
                    onJumpTo={jumpToMessage}
                    onMediaLoad={onMediaLoad}
                  />
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-panel border border-line text-frost shadow-lg hover:border-signal transition"
            aria-label="Jump to latest"
          >
            ↓
          </button>
        )}
      </div>

      <MessageInput key={channel._id} channel={channel} />
    </div>
  );
};

export default ChatContainer;
