import jwt from "jsonwebtoken";

// Generates a JWT and sets it as an HTTP-only cookie on the response.
// httpOnly   -> JS can never read it (XSS protection)
// sameSite   -> "strict": the browser never sends it on cross-site requests (CSRF)
// secure     -> only over HTTPS. Controlled by COOKIE_SECURE so a Docker
//               stack served over plain http://localhost still logs in;
//               set COOKIE_SECURE=true once you put TLS in front of it.
export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
  });

  return token;
};
