import rateLimit from "express-rate-limit";

// Applied only to auth routes — these are the ones worth protecting
// against brute-force / credential-stuffing attempts. A generous limit
// (not aggressive) since this is a demo app, but the pattern is the
// same one you'd tune down for production.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 signup/login attempts per IP per window
  standardHeaders: true, // return rate-limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});
