import express from "express";
import {
  signup,
  login,
  logout,
  updateProfile,
  checkAuth,
  getSocketToken,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  signupValidation,
  loginValidation,
  validateRequest,
} from "../middleware/validators.js";

const router = express.Router();

router.post("/signup", authLimiter, signupValidation, validateRequest, signup);
router.post("/login", authLimiter, loginValidation, validateRequest, login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.get("/check", protectRoute, checkAuth);
router.get("/socket-token", protectRoute, getSocketToken);

export default router;
