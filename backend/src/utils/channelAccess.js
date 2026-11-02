import mongoose from "mongoose";
import Channel from "../models/Channel.model.js";
import Message from "../models/Message.model.js";

export const requireChannelMember = async (channelId, userId) => {
  if (!mongoose.isValidObjectId(channelId)) {
    return { error: { status: 400, message: "Invalid channel id" } };
  }
  const channel = await Channel.findById(channelId);
  if (!channel) return { error: { status: 404, message: "Channel not found" } };
  if (!channel.members.some((m) => m.equals(userId))) {
    return { error: { status: 403, message: "Access denied" } };
  }
  return { channel };
};

export const requireMessageAccess = async (messageId, userId) => {
  if (!mongoose.isValidObjectId(messageId)) {
    return { error: { status: 400, message: "Invalid message id" } };
  }
  const message = await Message.findById(messageId);
  if (!message) return { error: { status: 404, message: "Message not found" } };
  const { channel, error } = await requireChannelMember(message.channelId, userId);
  if (error) return { error };
  return { message, channel };
};
