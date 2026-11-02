import { useEffect } from "react";
import Sidebar from "../components/Sidebar.jsx";
import ChatContainer from "../components/ChatContainer.jsx";
import ChatInfoPanel from "../components/ChatInfoPanel.jsx";
import NoChatSelected from "../components/NoChatSelected.jsx";
import { useChatStore } from "../store/useChatStore.js";

// Responsive like Telegram: phones show the chat list OR a conversation
// (with a back button); desktops show list + conversation (+ info panel).
const HomePage = () => {
  const channel = useChatStore((s) => s.channels.find((c) => c._id === s.selectedChannelId));
  const infoOpen = useChatStore((s) => s.infoOpen);
  const setInfoOpen = useChatStore((s) => s.setInfoOpen);
  const totalUnread = useChatStore((s) => s.channels.reduce((n, c) => n + (c.unreadCount || 0), 0));

  useEffect(() => {
    const { subscribeToSocketEvents, unsubscribeFromSocketEvents, reset } = useChatStore.getState();
    subscribeToSocketEvents();

    // Returning to the tab = you've now seen what arrived meanwhile.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const s = useChatStore.getState();
      const open = s.channels.find((c) => c._id === s.selectedChannelId);
      if (open?.unreadCount > 0) s.markChannelRead(open._id);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeFromSocketEvents();
      reset(); // don't leak one account's chats into the next login
    };
  }, []);

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ChatSpace` : "ChatSpace";
    return () => {
      document.title = "ChatSpace";
    };
  }, [totalUnread]);

  return (
    <div className="flex h-full">
      <div className={`${channel ? "hidden md:block" : "block"} w-full md:w-80 lg:w-96 shrink-0`}>
        <Sidebar />
      </div>

      <main className={`${channel ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        {channel ? <ChatContainer /> : <NoChatSelected />}
      </main>

      {channel && infoOpen && (
        <div className="fixed inset-0 z-40 md:static md:z-auto md:w-80 shrink-0">
          <ChatInfoPanel channel={channel} onClose={() => setInfoOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default HomePage;
