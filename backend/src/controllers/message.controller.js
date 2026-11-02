import Message from "../models/Message.model.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { emitToChannel } from "../sockets/socket.js";
import { requireChannelMember, requireMessageAccess } from "../utils/channelAccess.js";
import { ALLOWED_REACTIONS, MESSAGES_PAGE_SIZE } from "../utils/constants.js";

const withRelations = (query) =>
  query
    .populate("senderId", "fullName profilePic")
    .populate({
      path: "replyTo",
      select: "text image senderId isDeleted",
      populate: { path: "senderId", select: "fullName" },
    });

const fail = (res, error) => res.status(error.status).json({ message: error.message });

export const getMessages = async (req, res) => {
  try {
    const { error } = await requireChannelMember(req.params.channelId, req.user._id);
    if (error) return fail(res, error);

    const query = { channelId: req.params.channelId };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (Number.isNaN(before.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' cursor" });
      }
      query.createdAt = { $lt: before };
    }

    const messages = await withRelations(
      Message.find(query).sort({ createdAt: -1 }).limit(MESSAGES_PAGE_SIZE)
    );
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, replyTo } = req.body;
    const senderId = req.user._id;

    if (!text?.trim() && !image) {
      return res.status(400).json({ message: "Message must contain text or an image" });
    }

    const { channel, error } = await requireChannelMember(req.params.channelId, senderId);
    if (error) return fail(res, error);

    let replyToId = null;
    if (replyTo) {
      const target = await Message.findOne({ _id: replyTo, channelId: channel._id }).select("_id");
      if (!target) return res.status(400).json({ message: "Reply target not found" });
      replyToId = target._id;
    }

    let imageUrl;
    if (image) {
      if (!isCloudinaryConfigured) {
        return res.status(503).json({
          message: "Image uploads are not configured on this server (missing Cloudinary keys)",
        });
      }
      try {
        const upload = await cloudinary.uploader.upload(image, { folder: "chat_app_messages" });
        imageUrl = upload.secure_url;
      } catch (e) {
        console.error("Cloudinary upload failed:", e.message);
        return res.status(502).json({ message: "Image upload failed" });
      }
    }

    const created = await Message.create({
      channelId: channel._id,
      senderId,
      text,
      image: imageUrl,
      replyTo: replyToId,
      seenBy: [senderId],
    });

    channel.lastMessage = created._id;
    await channel.save();

    const message = await withRelations(Message.findById(created._id));
    emitToChannel(channel._id, "newMessage", message);

    res.status(201).json(message);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { message, error } = await requireMessageAccess(req.params.messageId, req.user._id);
    if (error) return fail(res, error);

    if (!message.senderId.equals(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot edit a deleted message" });
    }
    const text = req.body.text.trim();
    if (!text && !message.image) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const payload = {
      _id: message._id,
      channelId: message.channelId,
      text: message.text,
      editedAt: message.editedAt,
    };
    emitToChannel(message.channelId, "messageEdited", payload);
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { message, channel, error } = await requireMessageAccess(
      req.params.messageId,
      req.user._id
    );
    if (error) return fail(res, error);

    const isSender = message.senderId.equals(req.user._id);
    const isGroupAdmin =
      channel.type === "group" && channel.admins.some((a) => a.equals(req.user._id));
    if (!isSender && !isGroupAdmin) {
      return res.status(403).json({ message: "You can't delete this message" });
    }

    message.isDeleted = true;
    message.text = "";
    message.image = undefined;
    message.reactions = [];
    await message.save();

    emitToChannel(message.channelId, "messageDeleted", {
      _id: message._id,
      channelId: message.channelId,
    });
    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const userId = req.user._id;
    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ message: "Unsupported reaction" });
    }

    const { message, error } = await requireMessageAccess(req.params.messageId, userId);
    if (error) return fail(res, error);
    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot react to a deleted message" });
    }

    const previous = message.reactions.find((r) => r.userId.equals(userId));
    message.reactions = message.reactions.filter((r) => !r.userId.equals(userId));
    if (!previous || previous.emoji !== emoji) {
      message.reactions.push({ emoji, userId });
    }
    await message.save();

    const payload = {
      _id: message._id,
      channelId: message.channelId,
      reactions: message.reactions,
    };
    emitToChannel(message.channelId, "messageReacted", payload);
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in reactToMessage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const markChannelRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { channel, error } = await requireChannelMember(req.params.channelId, userId);
    if (error) return fail(res, error);

    const result = await Message.updateMany(
      { channelId: channel._id, senderId: { $ne: userId }, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    if (result.modifiedCount > 0) {
      emitToChannel(channel._id, "messagesSeen", { channelId: channel._id, userId });
    }
    res.status(200).json({ marked: result.modifiedCount });
  } catch (error) {
    console.error("Error in markChannelRead:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
