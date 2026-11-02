import { body, validationResult } from "express-validator";
import { ALLOWED_REACTIONS } from "../utils/constants.js";

// Runs after the body(...) checks below and turns any failures into a
// single, consistent 400 response — so controllers never have to think
// about malformed input, only business logic.
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg, // surface the first error to keep the UI simple
      errors: errors.array(),
    });
  }
  next();
};

export const signupValidation = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ max: 60 })
    .withMessage("Full name is too long"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const loginValidation = [
  body("email").trim().isEmail().withMessage("Enter a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const groupChannelValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Channel name is required")
    .isLength({ max: 80 })
    .withMessage("Channel name is too long"),
  body("memberIds")
    .isArray({ min: 1 })
    .withMessage("Select at least one member"),
];

export const sendMessageValidation = [
  body("text")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 5000 })
    .withMessage("Message is too long"),
  body("replyTo")
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage("Invalid reply target"),
  // Image size is bounded by the JSON body limit in server.js.
];

export const editMessageValidation = [
  body("text")
    .isString()
    .withMessage("Text is required")
    .isLength({ max: 5000 })
    .withMessage("Message is too long"),
];

export const reactionValidation = [
  body("emoji").isIn(ALLOWED_REACTIONS).withMessage("Unsupported reaction"),
];

export const renameGroupValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Channel name is required")
    .isLength({ max: 80 })
    .withMessage("Channel name is too long"),
];

export const memberIdsValidation = [
  body("memberIds").isArray({ min: 1 }).withMessage("Select at least one member"),
];
