import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, trim: true, default: "" },
    image: { type: String }, // Cloudinary URL, optional

    // Reply-to: a reference, not a copy, so edits/deletes of the original
    // are reflected everywhere it is quoted.
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Read receipts: users who have seen this message.
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // One reaction per user per message (Telegram default behaviour).
    reactions: [reactionSchema],

    editedAt: { type: Date },

    // Soft delete: the row stays (so replies/ordering don't break) but its
    // content is wiped and the UI renders "Message deleted".
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves the two hot queries: paging history (channel + createdAt cursor)
// and unread counts (channel + sender + seenBy).
messageSchema.index({ channelId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
