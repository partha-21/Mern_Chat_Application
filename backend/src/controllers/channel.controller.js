import mongoose from "mongoose";
import Channel from "../models/Channel.model.js";
import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import { MEMBER_FIELDS } from "../utils/constants.js";
import { requireChannelMember } from "../utils/channelAccess.js";
import {
  emitToChannel,
  emitToUser,
  joinChannelRoom,
  leaveChannelRoom,
} from "../sockets/socket.js";

const withRelations = (query) =>
  query
    .populate("members", MEMBER_FIELDS)
    .populate({
      path: "lastMessage",
      populate: { path: "senderId", select: "fullName profilePic" },
    });

const fail = (res, error) => res.status(error.status).json({ message: error.message });
const validIds = (ids = []) => [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id));

export const accessDirectChannel = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({ message: "A valid receiverId is required" });
    }
    if (receiverId === senderId.toString()) {
      return res.status(400).json({ message: "Cannot DM yourself" });
    }

    let channel = await withRelations(
      Channel.findOne({
        type: "direct",
        members: { $all: [senderId, receiverId], $size: 2 },
      })
    );
    if (channel) return res.status(200).json(channel);

    if (!(await User.exists({ _id: receiverId }))) {
      return res.status(404).json({ message: "User not found" });
    }

    const created = await Channel.create({
      type: "direct",
      members: [senderId, receiverId],
      createdBy: senderId,
    });

    joinChannelRoom([senderId, receiverId], created._id);

    channel = await withRelations(Channel.findById(created._id));
    res.status(201).json(channel);
  } catch (error) {
    console.error("Error in accessDirectChannel:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createGroupChannel = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.user._id;

    const ids = validIds(memberIds).filter((id) => id !== creatorId.toString());
    if (ids.length < 1) {
      return res.status(400).json({ message: "Select at least one valid member" });
    }
    const existing = await User.countDocuments({ _id: { $in: ids } });
    if (existing !== ids.length) {
      return res.status(400).json({ message: "One or more members do not exist" });
    }

    const members = [creatorId.toString(), ...ids];
    const created = await Channel.create({
      name,
      type: "group",
      members,
      admins: [creatorId],
      createdBy: creatorId,
    });

    joinChannelRoom(members, created._id);
    const channel = await withRelations(Channel.findById(created._id));
    emitToChannel(created._id, "channelCreated", channel);

    res.status(201).json(channel);
  } catch (error) {
    console.error("Error in createGroupChannel:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserChannels = async (req, res) => {
  try {
    const userId = req.user._id;

    const channels = await withRelations(
      Channel.find({ members: userId }).sort({ updatedAt: -1 })
    ).lean();

    const unread = await Message.aggregate([
      {
        $match: {
          channelId: { $in: channels.map((c) => c._id) },
          senderId: { $ne: userId },
          seenBy: { $ne: userId },
          isDeleted: false,
        },
      },
      { $group: { _id: "$channelId", count: { $sum: 1 } } },
    ]);
    const unreadByChannel = new Map(unread.map((u) => [u._id.toString(), u.count]));

    res.status(200).json(
      channels.map((c) => ({ ...c, unreadCount: unreadByChannel.get(c._id.toString()) || 0 }))
    );
  } catch (error) {
    console.error("Error in getUserChannels:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getChannelById = async (req, res) => {
  try {
    const { channel, error } = await requireChannelMember(req.params.channelId, req.user._id);
    if (error) return fail(res, error);
    res.status(200).json(await withRelations(Channel.findById(channel._id)));
  } catch (error) {
    console.error("Error in getChannelById:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const loadGroupAsAdmin = async (req, res, { allowSelfOnly = false } = {}) => {
  const { channel, error } = await requireChannelMember(req.params.channelId, req.user._id);
  if (error) {
    fail(res, error);
    return null;
  }
  if (channel.type !== "group") {
    res.status(400).json({ message: "Only group channels can be managed" });
    return null;
  }
  const isAdmin = channel.admins.some((a) => a.equals(req.user._id));
  if (!isAdmin && !allowSelfOnly) {
    res.status(403).json({ message: "Only group admins can do that" });
    return null;
  }
  return { channel, isAdmin };
};

export const renameGroup = async (req, res) => {
  try {
    const loaded = await loadGroupAsAdmin(req, res);
    if (!loaded) return;
    loaded.channel.name = req.body.name;
    await loaded.channel.save();

    const channel = await withRelations(Channel.findById(loaded.channel._id));
    emitToChannel(channel._id, "channelUpdated", channel);
    res.status(200).json(channel);
  } catch (error) {
    console.error("Error in renameGroup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addMembers = async (req, res) => {
  try {
    const loaded = await loadGroupAsAdmin(req, res);
    if (!loaded) return;
    const { channel } = loaded;

    const toAdd = validIds(req.body.memberIds).filter(
      (id) => !channel.members.some((m) => m.equals(id))
    );
    if (toAdd.length === 0) {
      return res.status(400).json({ message: "No new valid members to add" });
    }
    if ((await User.countDocuments({ _id: { $in: toAdd } })) !== toAdd.length) {
      return res.status(400).json({ message: "One or more users do not exist" });
    }

    channel.members.push(...toAdd);
    await channel.save();
    joinChannelRoom(toAdd, channel._id);

    const updated = await withRelations(Channel.findById(channel._id));
    emitToChannel(channel._id, "channelUpdated", updated);
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error in addMembers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const loaded = await loadGroupAsAdmin(req, res, { allowSelfOnly: true });
    if (!loaded) return;
    const { channel, isAdmin } = loaded;
    const targetId = req.params.userId;

    const isSelf = targetId === req.user._id.toString();
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: "Only group admins can remove members" });
    }
    if (!channel.members.some((m) => m.equals(targetId))) {
      return res.status(404).json({ message: "User is not in this channel" });
    }

    channel.members.pull(targetId);
    channel.admins.pull(targetId);

    if (channel.members.length === 0) {
      await Message.deleteMany({ channelId: channel._id });
      await channel.deleteOne();
    } else {
      if (channel.admins.length === 0) channel.admins.push(channel.members[0]);
      await channel.save();
    }

    emitToUser(targetId, "channelRemoved", { channelId: channel._id });
    leaveChannelRoom([targetId], channel._id);

    if (channel.members.length > 0) {
      const updated = await withRelations(Channel.findById(channel._id));
      emitToChannel(channel._id, "channelUpdated", updated);
    }
    res.status(200).json({ message: isSelf ? "You left the group" : "Member removed" });
  } catch (error) {
    console.error("Error in removeMember:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
