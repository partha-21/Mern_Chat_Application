import Channel from "../models/Channel.model.js";
import User from "../models/User.model.js";
import { getIO } from "./ioInstance.js";

export const userRoom = (id) => `user:${id}`;
export const channelRoom = (id) => `channel:${id}`;

export const emitToChannel = (channelId, event, payload) =>
  getIO()?.to(channelRoom(channelId)).emit(event, payload);

export const emitToUser = (userId, event, payload) =>
  getIO()?.to(userRoom(userId)).emit(event, payload);

export const joinChannelRoom = (userIds, channelId) => {
  const rooms = userIds.map((id) => userRoom(id.toString()));
  if (rooms.length) getIO()?.in(rooms).socketsJoin(channelRoom(channelId));
};
export const leaveChannelRoom = (userIds, channelId) => {
  const rooms = userIds.map((id) => userRoom(id.toString()));
  if (rooms.length) getIO()?.in(rooms).socketsLeave(channelRoom(channelId));
};

const onlineUsers = new Map();
export const getOnlineUserIds = () => [...onlineUsers.keys()];

export const registerSocketHandlers = async (io, socket) => {
  const userId = socket.user._id.toString();

  const wasOnline = onlineUsers.has(userId);
  if (!wasOnline) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);
  socket.join(userRoom(userId));

  socket.on("typing", ({ channelId } = {}) => {
    if (!socket.rooms.has(channelRoom(channelId))) return;
    socket.to(channelRoom(channelId)).emit("userTyping", {
      channelId,
      userId,
      fullName: socket.user.fullName,
    });
  });
  socket.on("stopTyping", ({ channelId } = {}) => {
    if (!socket.rooms.has(channelRoom(channelId))) return;
    socket.to(channelRoom(channelId)).emit("userStopTyping", { channelId, userId });
  });

  socket.on("disconnect", async () => {
    const sockets = onlineUsers.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      onlineUsers.delete(userId);
      const lastSeen = new Date();
      io.emit("getOnlineUsers", getOnlineUserIds());
      io.emit("userOffline", { userId, lastSeen });
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen }).exec();
    }
  });

  io.emit("getOnlineUsers", getOnlineUserIds());
  if (!wasOnline) User.findByIdAndUpdate(userId, { isOnline: true }).exec();

  const channels = await Channel.find({ members: userId }).select("_id");
  if (socket.connected) socket.join(channels.map((c) => channelRoom(c._id)));
};
