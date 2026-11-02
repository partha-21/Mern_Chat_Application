import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      // Not required for DMs — only relevant for group channels
    },
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Denormalized pointer to last message — huge perf win for sidebar list
    // rendering, avoids a separate aggregation query per channel on load.
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Compound index to speed up "find channels containing these members" queries.
channelSchema.index({ members: 1, type: 1 });

const Channel = mongoose.model("Channel", channelSchema);
export default Channel;
