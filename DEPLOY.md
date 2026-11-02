# Deploying ChatSpace on free tiers (Render, optionally Vercel)

## Pick a setup

| | A. Render only (recommended) | B. Vercel + Render |
|---|---|---|
| Website | served by the Render service | Vercel (static) |
| API + WebSockets | Render | Render |
| Origins | 1 | 2 (Vercel rewrites `/api` to Render) |
| Setup effort | lowest | a few more steps |

**Why the backend can't be on Vercel:** Vercel Functions can't act as a WebSocket
server, and Socket.io needs a long-lived process. Vercel is fine for the static
React build only. Render (a normal long-running web service) hosts the API.
MongoDB must be external either way: use **MongoDB Atlas free (M0)**.

---
## 1. MongoDB Atlas (free)
1. Create a free **M0** cluster at <https://www.mongodb.com/atlas> (pick a region near your Render region).
2. *Database Access* → add a user + password. If the password has special characters (`@ : / ?`), URL-encode them in the connection string.
3. *Network Access* → **Add IP Address → Allow access from anywhere (0.0.0.0/0)**. Render's free instances have no fixed outbound IP, so an allow-list of IPs won't work.
4. *Connect → Drivers* → copy the string and put the database name in it:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority`

## 2. Put the code on GitHub
Render and Vercel both deploy from a Git repo. Unzip the project, then:
```bash
git init && git add . && git commit -m "ChatSpace"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/YOU/chatspace.git && git push -u origin main
```
(`.env` files are git-ignored, so your secrets stay local.)

---
## Option A: Render only
**Blueprint (fastest):** Render dashboard → *New* → *Blueprint* → select the repo →
paste **MONGO_URI** when asked → *Apply*. `render.yaml` does the rest.

**Manual alternative:** *New → Web Service* → the repo, then:

| Field | Value |
|---|---|
| Runtime | Node |
| Build command | `npm --prefix frontend ci --include=dev && npm --prefix frontend run build && npm --prefix backend ci --omit=dev` |
| Start command | `node backend/src/server.js` |
| Health check path | `/api/health` |
| Instance type | Free |

Environment variables: `NODE_VERSION=20`, `NODE_ENV=production`, `COOKIE_SECURE=true`,
`TRUST_PROXY=1`, `JWT_SECRET=<long random string>`, `MONGO_URI=<Atlas string>`.
Optional: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
(without them everything works except image messages and profile pictures).
You do **not** need `CLIENT_URL`: Render's own `RENDER_EXTERNAL_URL` is used.

Open `https://<your-service>.onrender.com`. Done.

---
## Option B: Vercel (website) + Render (API)
1. Do **Option A** first so the API exists. Note its URL.
2. Edit `frontend/vercel.json`: replace `YOUR-RENDER-SERVICE` with your service name, commit, push.
   REST calls (`/api/*`) go through this rewrite, so the browser sees ONE origin and the
   session cookie works (including Safari).
3. Vercel → *Add New → Project* → import the repo →
   **Root Directory: `frontend`** (framework Vite is auto-detected) →
   Environment Variable **`VITE_SOCKET_URL` = `https://<your-service>.onrender.com`** → Deploy.
   WebSockets connect directly to Render because Vercel can't proxy them; they authenticate
   with a short-lived token (not a cookie), so no third-party-cookie problems.
4. Back on Render, set **`CLIENT_URL`** to your Vercel URL, e.g. `https://chatspace.vercel.app`
   (several origins can be comma-separated) → it redeploys.
   Vercel *preview* URLs differ per deployment; add them here if you want to test on previews.

---
## Free-tier behaviour you should know
- **Render free web services spin down after 15 minutes without inbound traffic**, then wake on the next request ([Render docs](https://render.com/docs/free)). ChatSpace shows a "Waking up the server…" screen and keeps retrying, so the first visit after idle is slow, not broken. A third-party write-up says WebSocket messages from existing connections count as inbound traffic, so an active chat should keep it awake.
- **750 free instance hours per workspace per month**; spun-down time doesn't count. A service kept awake 24/7 uses roughly the whole allowance, and Render suspends free services when it runs out.
- **Ephemeral filesystem, and Render may restart a free service at any time.** ChatSpace stores nothing on disk (messages in Atlas, images in Cloudinary). Restarts drop live sockets; the client reconnects and re-fetches what it missed.
- An uptime pinger (e.g. every 14 min) can stop the sleeping, but it isn't an officially supported fix and burns your free hours. Optional; your call.
- Free-tier limits change. Check <https://render.com/docs/free> and Atlas/Vercel/Cloudinary pricing before relying on them.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Build fails with `vite: not found` | Build command must use `--include=dev` for the frontend (shown above). |
| `Missing required environment variable` in logs | Set `MONGO_URI` (and `JWT_SECRET`) on Render. |
| `MongoServerSelectionError` | Atlas *Network Access* must allow `0.0.0.0/0`; check user/password and URL-encoding. |
| Login works, but you're logged out on refresh | `COOKIE_SECURE=true` needs HTTPS (Render/Vercel are). On plain `http://` use `false`. |
| Option B: API calls fail / 404 | `vercel.json` still has the `YOUR-RENDER-SERVICE` placeholder. |
| Option B: chats load but no live updates | `VITE_SOCKET_URL` missing on Vercel, or `CLIENT_URL` on Render doesn't match the Vercel URL exactly. Redeploy Vercel after changing env vars (Vite bakes them in at build time). |
| First load takes ~1 minute | Free instance was asleep. Expected. |
| Images fail with "not configured" | Add the three `CLOUDINARY_*` variables. |
