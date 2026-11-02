import express from "express";
import {
  accessDirectChannel,
  createGroupChannel,
  getUserChannels,
  getChannelById,
  renameGroup,
  addMembers,
  removeMember,
} from "../controllers/channel.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  groupChannelValidation,
  renameGroupValidation,
  memberIdsValidation,
  validateRequest,
} from "../middleware/validators.js";

const router = express.Router();
router.use(protectRoute);

router.get("/", getUserChannels);
router.post("/direct", accessDirectChannel);
router.post("/group", groupChannelValidation, validateRequest, createGroupChannel);

router.get("/:channelId", getChannelById);
router.patch("/:channelId", renameGroupValidation, validateRequest, renameGroup);
router.post("/:channelId/members", memberIdsValidation, validateRequest, addMembers);
router.delete("/:channelId/members/:userId", removeMember);

export default router;
