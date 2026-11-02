import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import { connectDB } from "./config/db.js";
import User from "./models/User.model.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import channelRoutes from "./routes/channel.routes.js";
import messageRoutes from "./routes/message.routes.js";
import { registerSocketHandlers } from "./sockets/socket.js";
import { setIO } from "./sockets/ioInstance.js";

dotenv.config();

const allowedOrigins = (process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const missing = ["MONGO_URI", "JWT_SECRET"].filter((key) => !process.env[key]);
if (allowedOrigins.length === 0) missing.push("CLIENT_URL");
if (missing.length > 0) {
  console.error(`❌ Missing required environment variable(s): ${missing.join(", ")}`);
  console.error("   Copy .env.example to .env (or set them in your host's dashboard).");
  process.exit(1);
}

const app = express();

app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        "connect-src": ["'self'", "ws:", "wss:"],
        "upgrade-insecure-requests": null,
      },
    },
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = process.env.CLIENT_DIST || path.resolve(here, "../../frontend/dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );
  app.get(/^(?!\/(api|socket\.io)(\/|$)).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`🖥️  Serving web app from ${clientDist}`);
}

app.use(errorHandler);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});
setIO(io);

io.use(async (socket, next) => {
  try {
    let decoded;
    const handshakeToken = socket.handshake.auth?.token;

    if (handshakeToken) {
      decoded = jwt.verify(handshakeToken, process.env.JWT_SECRET);
      if (decoded.purpose !== "socket") throw new Error("wrong token type");
    } else {
      const raw = socket.handshake.headers.cookie;
      if (!raw) return next(new Error("Authentication error: No credentials sent"));
      const token = raw
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("jwt="))
        ?.slice(4);
      if (!token) return next(new Error("Authentication error: No token found"));
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.purpose) throw new Error("wrong token type");
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return next(new Error("Authentication error: User not found"));

    socket.user = user;
    next();
  } catch {
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.user.fullName} (${socket.id})`);
  registerSocketHandlers(io, socket).catch((err) =>
    console.error("Socket setup failed:", err.message)
  );
});

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT} (allowed origins: ${allowedOrigins.join(", ")})`);
});
