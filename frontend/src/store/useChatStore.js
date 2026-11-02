import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { getSocket } from "../lib/socket.js";
import { useToastStore } from "./useToastStore.js";
import { useAuthStore } from "./useAuthStore.js";

const PAGE_SIZE = 30;

const toast = (message, type) => useToastStore.getState().addToast(message, type);
const myId = () => useAuthStore.getState().authUser?._id;
const errorText = (e, fallback) => e.response?.data?.message || fallback;

const byRecent = (list) =>
  [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

const upsertChannel = (list, channel) => {
  const i = list.findIndex((c) => c._id === channel._id);
  if (i === -1) return byRecent([{ unreadCount: 0, ...channel }, ...list]);
  const next = [...list];
  next[i] = { ...next[i], ...channel, unreadCount: channel.unreadCount ?? next[i].unreadCount };
  return next;
};

const patchLastMessage = (channels, id, patch) =>
  channels.map((c) =>
    c.lastMessage?._id === id ? { ...c, lastMessage: { ...c.lastMessage, ...patch } } : c
  );

const typingTimers = {};
let connectHandler = null;

const SOCKET_EVENTS = [
  "newMessage", "messageEdited", "messageDeleted", "messageReacted", "messagesSeen",
  "channelCreated", "channelUpdated", "channelRemoved",
  "userTyping", "userStopTyping", "userOffline",
];

const initialState = {
  channels: [],
  users: [],
  messages: [],
  selectedChannelId: null,
  isMessagesLoading: false,
  isLoadingOlder: false,
  hasMore: true,
  typing: {},
  lastSeen: {},
  replyingTo: null,
  editing: null,
  infoOpen: false,
};

export const useChatStore = create((set, get) => ({
  ...initialState,
  reset: () => set({ ...initialState }),

  getUsers: async () => {
    try {
      const res = await axiosInstance.get("/users");
      set({ users: res.data });
    } catch (e) {
      toast(errorText(e, "Couldn't load users"));
    }
  },

  getChannels: async ({ silent = false } = {}) => {
    try {
      const res = await axiosInstance.get("/channels");
      set({ channels: res.data });
    } catch (e) {
      if (!silent) toast(errorText(e, "Couldn't load chats"));
    }
  },

  selectChannel: (channelId) => {
    if (channelId === get().selectedChannelId) return;
    set({
      selectedChannelId: channelId,
      messages: [],
      hasMore: true,
      replyingTo: null,
      editing: null,
      infoOpen: false,
      isMessagesLoading: Boolean(channelId),
    });
    if (channelId) get().getMessages(channelId);
  },

  openDirectChannel: async (userId) => {
    try {
      const res = await axiosInstance.post("/channels/direct", { receiverId: userId });
      set((s) => ({ channels: upsertChannel(s.channels, res.data) }));
      get().selectChannel(res.data._id);
    } catch (e) {
      toast(errorText(e, "Couldn't open the conversation"));
    }
  },

  getMessages: async (channelId) => {
    try {
      const res = await axiosInstance.get(`/messages/${channelId}`);
      if (get().selectedChannelId !== channelId) return; // user already switched chats
      set({ messages: res.data, hasMore: res.data.length === PAGE_SIZE });
      const channel = get().channels.find((c) => c._id === channelId);
      if (channel?.unreadCount > 0) get().markChannelRead(channelId);
    } catch (e) {
      if (get().selectedChannelId === channelId) toast(errorText(e, "Couldn't load messages"));
    } finally {
      if (get().selectedChannelId === channelId) set({ isMessagesLoading: false });
    }
  },

  loadOlderMessages: async () => {
    const { selectedChannelId, messages, hasMore, isLoadingOlder } = get();
    if (!selectedChannelId || !hasMore || isLoadingOlder || messages.length === 0) return 0;

    set({ isLoadingOlder: true });
    try {
      const res = await axiosInstance.get(`/messages/${selectedChannelId}`, {
        params: { before: messages[0].createdAt },
      });
      if (get().selectedChannelId !== selectedChannelId) return 0;
      set((s) => ({
        messages: [...res.data, ...s.messages],
        hasMore: res.data.length === PAGE_SIZE,
      }));
      return res.data.length;
    } catch (e) {
      toast(errorText(e, "Couldn't load older messages"));
      return 0;
    } finally {
      set({ isLoadingOlder: false });
    }
  },

  markChannelRead: async (channelId) => {
    set((s) => ({
      channels: s.channels.map((c) => (c._id === channelId ? { ...c, unreadCount: 0 } : c)),
    }));
    try {
      await axiosInstance.put(`/messages/channel/${channelId}/read`);
    } catch {
      /* non-critical; next open retries */
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message, editing: null }),
  setEditing: (message) => set({ editing: message, replyingTo: null }),
  setInfoOpen: (open) => set({ infoOpen: open }),

  sendMessage: async ({ text, image }) => {
    const { selectedChannelId, replyingTo } = get();
    if (!selectedChannelId) return false;
    try {
      const res = await axiosInstance.post(`/messages/${selectedChannelId}`, {
        text,
        image,
        replyTo: replyingTo?._id,
      });
      set({ replyingTo: null });
      get().applyIncomingMessage(res.data);
      return true;
    } catch (e) {
      toast(errorText(e, "Message failed to send"));
      return false;
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}`, { text });
      get().applyEdit(res.data);
      set({ editing: null });
      return true;
    } catch (e) {
      toast(errorText(e, "Couldn't edit the message"));
      return false;
    }
  },

  deleteMessage: async (message) => {
    try {
      await axiosInstance.delete(`/messages/${message._id}`);
      get().applyDelete({ _id: message._id, channelId: message.channelId });
    } catch (e) {
      toast(errorText(e, "Couldn't delete the message"));
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      get().applyReactions(res.data);
    } catch (e) {
      toast(errorText(e, "Couldn't add the reaction"));
    }
  },

  createGroupChannel: async ({ name, memberIds }) => {
    try {
      const res = await axiosInstance.post("/channels/group", { name, memberIds });
      set((s) => ({ channels: upsertChannel(s.channels, res.data) }));
      get().selectChannel(res.data._id);
      return { success: true };
    } catch (e) {
      return { success: false, message: errorText(e, "Failed to create channel") };
    }
  },

  renameGroup: async (channelId, name) => {
    try {
      const res = await axiosInstance.patch(`/channels/${channelId}`, { name });
      set((s) => ({ channels: upsertChannel(s.channels, res.data) }));
      return true;
    } catch (e) {
      toast(errorText(e, "Couldn't rename the group"));
      return false;
    }
  },

  addMembers: async (channelId, memberIds) => {
    try {
      const res = await axiosInstance.post(`/channels/${channelId}/members`, { memberIds });
      set((s) => ({ channels: upsertChannel(s.channels, res.data) }));
      return true;
    } catch (e) {
      toast(errorText(e, "Couldn't add members"));
      return false;
    }
  },

  removeMember: async (channelId, userId) => {
    try {
      await axiosInstance.delete(`/channels/${channelId}/members/${userId}`);
      if (userId === myId()) get().applyChannelRemoved(channelId);
      else get().getChannels({ silent: true });
      return true;
    } catch (e) {
      toast(errorText(e, "Couldn't remove the member"));
      return false;
    }
  },

  applyIncomingMessage: (message) => {
    const { selectedChannelId, channels } = get();
    const mine = message.senderId._id === myId();
    const isOpen = message.channelId === selectedChannelId;
    const seenNow = isOpen && document.visibilityState === "visible";

    if (isOpen) {
      set((s) =>
        s.messages.some((m) => m._id === message._id)
          ? s
          : { messages: [...s.messages, message] }
      );
    }

    if (!channels.some((c) => c._id === message.channelId)) {
      get().getChannels({ silent: true });
      return;
    }

    set((s) => ({
      channels: byRecent(
        s.channels.map((c) =>
          c._id !== message.channelId
            ? c
            : {
                ...c,
                lastMessage: message,
                updatedAt: message.createdAt,
                unreadCount: mine || seenNow ? c.unreadCount : c.unreadCount + 1,
              }
        )
      ),
    }));

    if (!mine) {
      get().clearTyping(message.channelId, message.senderId._id);
      if (seenNow) get().markChannelRead(message.channelId);
    }
  },

  applyEdit: ({ _id, text, editedAt }) =>
    set((s) => ({
      messages: s.messages.map((m) => (m._id === _id ? { ...m, text, editedAt } : m)),
      channels: patchLastMessage(s.channels, _id, { text, editedAt }),
    })),

  applyDelete: ({ _id }) => {
    const wiped = { isDeleted: true, text: "", image: null };
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m._id === _id) return { ...m, ...wiped, reactions: [] };
        if (m.replyTo?._id === _id) return { ...m, replyTo: { ...m.replyTo, ...wiped } };
        return m;
      }),
      channels: patchLastMessage(s.channels, _id, wiped),
    }));
  },

  applyReactions: ({ _id, reactions }) =>
    set((s) => ({
      messages: s.messages.map((m) => (m._id === _id ? { ...m, reactions } : m)),
    })),

  applySeen: ({ channelId, userId }) =>
    set((s) => ({
      messages:
        s.selectedChannelId === channelId
          ? s.messages.map((m) =>
              m.senderId._id !== userId && !m.seenBy.includes(userId)
                ? { ...m, seenBy: [...m.seenBy, userId] }
                : m
            )
          : s.messages,
      channels: s.channels.map((c) => {
        const last = c.lastMessage;
        if (c._id !== channelId || !last || last.senderId._id === userId) return c;
        if (last.seenBy?.includes(userId)) return c;
        return { ...c, lastMessage: { ...last, seenBy: [...(last.seenBy || []), userId] } };
      }),
    })),

  applyChannelRemoved: (channelId) =>
    set((s) => {
      const wasOpen = s.selectedChannelId === channelId;
      return {
        channels: s.channels.filter((c) => c._id !== channelId),
        ...(wasOpen ? { selectedChannelId: null, messages: [], infoOpen: false } : {}),
      };
    }),

  clearTyping: (channelId, userId) =>
    set((s) => {
      const inChannel = { ...(s.typing[channelId] || {}) };
      delete inChannel[userId];
      return { typing: { ...s.typing, [channelId]: inChannel } };
    }),

  subscribeToSocketEvents: () => {
    const socket = getSocket();
    if (!socket) return;
    get().unsubscribeFromSocketEvents();

    socket.on("newMessage", (m) => get().applyIncomingMessage(m));
    socket.on("messageEdited", (p) => get().applyEdit(p));
    socket.on("messageDeleted", (p) => get().applyDelete(p));
    socket.on("messageReacted", (p) => get().applyReactions(p));
    socket.on("messagesSeen", (p) => get().applySeen(p));

    socket.on("channelCreated", (c) => set((s) => ({ channels: upsertChannel(s.channels, c) })));
    socket.on("channelUpdated", (c) => set((s) => ({ channels: upsertChannel(s.channels, c) })));
    socket.on("channelRemoved", ({ channelId }) => get().applyChannelRemoved(channelId));

    socket.on("userTyping", ({ channelId, userId, fullName }) => {
      set((s) => ({
        typing: { ...s.typing, [channelId]: { ...(s.typing[channelId] || {}), [userId]: fullName } },
      }));
      const key = `${channelId}:${userId}`;
      clearTimeout(typingTimers[key]);
      typingTimers[key] = setTimeout(() => get().clearTyping(channelId, userId), 4000);
    });
    socket.on("userStopTyping", ({ channelId, userId }) => get().clearTyping(channelId, userId));
    socket.on("userOffline", ({ userId, lastSeen }) =>
      set((s) => ({ lastSeen: { ...s.lastSeen, [userId]: lastSeen } }))
    );

    // After a dropped connection (or a free-tier server waking up), catch up
    // on whatever was missed. The very first connect needs no catch-up.
    let hadConnection = socket.connected;
    connectHandler = async () => {
      if (!hadConnection) {
        hadConnection = true;
        return;
      }
      get().getChannels({ silent: true });
      const id = get().selectedChannelId;
      if (!id) return;
      try {
        const res = await axiosInstance.get(`/messages/${id}`);
        if (get().selectedChannelId === id) {
          set({ messages: res.data, hasMore: res.data.length === PAGE_SIZE });
        }
      } catch {
        /* next event will retry */
      }
    };
    socket.on("connect", connectHandler);
  },

  unsubscribeFromSocketEvents: () => {
    const socket = getSocket();
    if (!socket) return;
    SOCKET_EVENTS.forEach((e) => socket.off(e));
    if (connectHandler) socket.off("connect", connectHandler);
    connectHandler = null;
  },
}));
