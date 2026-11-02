import express from "express";
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  markChannelRead,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  sendMessageValidation,
  editMessageValidation,
  reactionValidation,
  validateRequest,
} from "../middleware/validators.js";

const router = express.Router();
router.use(protectRoute);

router.put("/channel/:channelId/read", markChannelRead);
router.get("/:channelId", getMessages);
router.post("/:channelId", sendMessageValidation, validateRequest, sendMessage);
router.put("/:messageId", editMessageValidation, validateRequest, editMessage);
router.delete("/:messageId", deleteMessage);
router.post("/:messageId/react", reactionValidation, validateRequest, reactToMessage);

export default router;
