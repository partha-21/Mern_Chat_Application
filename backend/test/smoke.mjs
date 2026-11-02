// End-to-end smoke test: real HTTP + real Socket.io clients against a
// RUNNING server and database. Usage:  npm run smoke   (server must be up)
import assert from "node:assert/strict";
import { io } from "socket.io-client";

const BASE = process.env.BASE_URL || "http://localhost:5001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (name) => {
  passed++;
  console.log("  ✓", name);
};

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
    this.sockets = [];
  }
  async api(method, path, body) {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = io(BASE, {
        extraHeaders: { Cookie: this.cookie },
        transports: ["websocket"],
        reconnection: false,
      });
      socket.log = [];
      socket.onAny((e, p) => socket.log.push({ e, p }));
      socket.on("connect", async () => {
        await sleep(200); // let the server finish joining rooms
        resolve(socket);
      });
      socket.on("connect_error", reject);
      this.sockets.push(socket);
    });
  }
}

// Opens a raw socket with given options; resolves {ok, socket|error} (never throws).
const tryConnect = (opts) =>
  new Promise((resolve) => {
    const s = io(BASE, { transports: ["websocket"], reconnection: false, ...opts });
    s.on("connect", () => resolve({ ok: true, socket: s }));
    s.on("connect_error", (e) => {
      s.close();
      resolve({ ok: false, error: e.message });
    });
  });

const waitFor = async (socket, event, pred = () => true, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = socket.log.find((x) => x.e === event && pred(x.p));
    if (hit) return hit.p;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for socket event "${event}"`);
};
const never = async (socket, event, pred = () => true, ms = 500) => {
  await sleep(ms);
  assert.ok(!socket.log.find((x) => x.e === event && pred(x.p)), `unexpected "${event}"`);
};

const run = async () => {
  const tag = Date.now();
  const [A, B, C, D] = ["Alice", "Bob", "Carol", "Dave"].map((n) => new Client(n));

  console.log("\nAuth");
  for (const u of [A, B, C, D]) {
    const r = await u.api("POST", "/auth/signup", {
      fullName: u.name,
      email: `${u.name.toLowerCase()}${tag}@test.com`,
      password: "secret123",
    });
    assert.equal(r.status, 201);
    u.id = r.data._id;
  }
  ok("4 users signed up (cookie issued)");
  assert.equal((await new Client("x").api("GET", "/channels")).status, 401);
  ok("unauthenticated request rejected (401)");

  console.log("\nSocket auth (token path: works across sites, no cookie needed)");
  assert.equal((await new Client("x").api("GET", "/auth/socket-token")).status, 401);
  const socketToken = (await A.api("GET", "/auth/socket-token")).data.token;
  assert.ok(socketToken);
  ok("socket token is only issued to a logged-in user");
  const viaToken = await tryConnect({ auth: { token: socketToken } }); // note: NO cookie header
  assert.equal(viaToken.ok, true);
  viaToken.socket.disconnect();
  ok("a socket connects with just the token (no cookie), as a Vercel-hosted site must");
  const sessionJwt = A.cookie.replace("jwt=", "");
  assert.equal((await tryConnect({ auth: { token: sessionJwt } })).ok, false);
  assert.equal((await tryConnect({})).ok, false);
  ok("a session JWT is not accepted as a socket token; no credentials = rejected");
  const asSession = await fetch(`${BASE}/api/channels`, { headers: { Cookie: `jwt=${socketToken}` } });
  assert.equal(asSession.status, 401);
  ok("a socket token can't be used as a login session");

  console.log("\nPresence (multi-device)");
  const bSock = await B.connect();
  const aSock = await A.connect();
  const cSock = await C.connect();
  await waitFor(aSock, "getOnlineUsers", (ids) => ids.includes(B.id));
  ok("online list broadcast includes other users");
  const aSock2 = await A.connect(); // second tab
  aSock2.disconnect();
  await never(bSock, "userOffline", (p) => p.userId === A.id, 600);
  ok("closing ONE of a user's two tabs does not mark them offline");

  console.log("\nDirect messages, unread, read receipts");
  const dm = (await A.api("POST", "/channels/direct", { receiverId: B.id })).data;
  assert.equal(dm.type, "direct");
  const dm2 = (await A.api("POST", "/channels/direct", { receiverId: B.id })).data;
  assert.equal(dm._id, dm2._id);
  ok("DM created once, second call returns the same channel (no duplicates)");

  const sent = await A.api("POST", `/messages/${dm._id}`, { text: "hello bob" });
  assert.equal(sent.status, 201);
  const m1 = sent.data;
  const got = await waitFor(bSock, "newMessage", (m) => m._id === m1._id);
  assert.equal(got.text, "hello bob");
  ok("receiver gets the message in real time (room joined at channel creation)");

  let bChannels = (await B.api("GET", "/channels")).data;
  assert.equal(bChannels.find((c) => c._id === dm._id).unreadCount, 1);
  ok("unread badge count = 1 for the receiver");
  assert.equal((await A.api("GET", "/channels")).data.find((c) => c._id === dm._id).unreadCount, 0);
  ok("sender's own messages are never unread");

  assert.equal((await B.api("PUT", `/messages/channel/${dm._id}/read`)).data.marked, 1);
  await waitFor(aSock, "messagesSeen", (p) => p.userId === B.id);
  ok("bulk mark-read -> sender gets messagesSeen (✓✓)");
  bChannels = (await B.api("GET", "/channels")).data;
  assert.equal(bChannels.find((c) => c._id === dm._id).unreadCount, 0);
  ok("unread badge back to 0");

  console.log("\nReply, edit, react, delete");
  const reply = (await B.api("POST", `/messages/${dm._id}`, { text: "hi alice", replyTo: m1._id })).data;
  assert.equal(reply.replyTo._id, m1._id);
  assert.equal(reply.replyTo.senderId.fullName, "Alice");
  ok("reply stores a reference and returns the quoted message + author");
  const otherDm = (await C.api("POST", "/channels/direct", { receiverId: D.id })).data;
  const foreign = (await C.api("POST", `/messages/${otherDm._id}`, { text: "x" })).data;
  assert.equal((await B.api("POST", `/messages/${dm._id}`, { text: "bad", replyTo: foreign._id })).status, 400);
  ok("cannot reply to a message from a different channel");

  assert.equal((await B.api("PUT", `/messages/${m1._id}`, { text: "hacked" })).status, 403);
  ok("only the sender can edit");
  await A.api("PUT", `/messages/${m1._id}`, { text: "hello bob (edited)" });
  const ed = await waitFor(bSock, "messageEdited", (p) => p._id === m1._id);
  assert.equal(ed.text, "hello bob (edited)");
  assert.ok(ed.editedAt);
  ok("edit broadcast to the other side with editedAt");

  await B.api("POST", `/messages/${m1._id}/react`, { emoji: "👍" });
  let re = await waitFor(aSock, "messageReacted", (p) => p._id === m1._id && p.reactions.length === 1);
  assert.equal(re.reactions[0].emoji, "👍");
  ok("reaction added + broadcast");
  await B.api("POST", `/messages/${m1._id}/react`, { emoji: "❤️" });
  re = await waitFor(aSock, "messageReacted", (p) => p.reactions[0]?.emoji === "❤️");
  assert.equal(re.reactions.length, 1);
  ok("a second emoji REPLACES the user's reaction (1 per user)");
  await B.api("POST", `/messages/${m1._id}/react`, { emoji: "❤️" });
  await waitFor(aSock, "messageReacted", (p) => p.reactions.length === 0);
  ok("same emoji again toggles it off");
  assert.equal((await B.api("POST", `/messages/${m1._id}/react`, { emoji: "💩" })).status, 400);
  ok("unsupported emoji rejected");

  assert.equal((await B.api("DELETE", `/messages/${m1._id}`)).status, 403);
  assert.equal((await A.api("DELETE", `/messages/${m1._id}`)).status, 200);
  await waitFor(bSock, "messageDeleted", (p) => p._id === m1._id);
  const afterDel = (await A.api("GET", `/messages/${dm._id}`)).data.find((m) => m._id === m1._id);
  assert.equal(afterDel.isDeleted, true);
  assert.equal(afterDel.text, "");
  ok("delete is sender-only, soft (content wiped), broadcast live");

  console.log("\nAuthorization");
  assert.equal((await D.api("GET", `/messages/${dm._id}`)).status, 403);
  assert.equal((await D.api("POST", `/messages/${dm._id}`, { text: "intruder" })).status, 403);
  assert.equal((await D.api("PUT", `/messages/channel/${dm._id}/read`)).status, 403);
  assert.equal((await D.api("PUT", `/messages/${reply._id}`, { text: "x" })).status, 403);
  assert.equal((await D.api("GET", "/messages/not-an-id")).status, 400);
  ok("non-members can't read, write, mark-read or edit; bad ids -> 400");

  console.log("\nGroup chat");
  const g = (await A.api("POST", "/channels/group", { name: "Team", memberIds: [B.id, C.id] })).data;
  assert.deepEqual(g.admins, [A.id]);
  await waitFor(bSock, "channelCreated", (c) => c._id === g._id);
  await waitFor(cSock, "channelCreated", (c) => c._id === g._id);
  ok("members are notified live that they were added to a new group");
  await A.api("POST", `/messages/${g._id}`, { text: "welcome team" });
  await waitFor(bSock, "newMessage", (m) => m.text === "welcome team");
  await waitFor(cSock, "newMessage", (m) => m.text === "welcome team");
  ok("group message fans out to every member");

  cSock.emit("typing", { channelId: g._id });
  const t = await waitFor(aSock, "userTyping", (p) => p.userId === C.id);
  assert.equal(t.fullName, "Carol");
  await waitFor(bSock, "userTyping", (p) => p.userId === C.id);
  ok("group typing indicator reaches all other members, with the name");
  const dSock = await D.connect();
  dSock.emit("typing", { channelId: g._id });
  await never(aSock, "userTyping", (p) => p.userId === D.id, 500);
  ok("a non-member can't spoof typing into a group");

  assert.equal((await B.api("POST", `/channels/${g._id}/members`, { memberIds: [D.id] })).status, 403);
  assert.equal((await B.api("PATCH", `/channels/${g._id}`, { name: "Hax" })).status, 403);
  ok("non-admins can't add members or rename");
  const added = await A.api("POST", `/channels/${g._id}/members`, { memberIds: [D.id] });
  assert.equal(added.data.members.length, 4);
  await waitFor(dSock, "channelUpdated", (c) => c._id === g._id);
  await A.api("POST", `/messages/${g._id}`, { text: "hi dave" });
  await waitFor(dSock, "newMessage", (m) => m.text === "hi dave");
  ok("admin adds a member; their live socket joins the room immediately");
  await A.api("PATCH", `/channels/${g._id}`, { name: "Team Renamed" });
  await waitFor(bSock, "channelUpdated", (c) => c.name === "Team Renamed");
  ok("rename broadcast to members");

  assert.equal((await B.api("DELETE", `/channels/${g._id}/members/${C.id}`)).status, 403);
  assert.equal((await A.api("DELETE", `/channels/${g._id}/members/${C.id}`)).status, 200);
  await waitFor(cSock, "channelRemoved", (p) => p.channelId === g._id);
  assert.equal((await C.api("POST", `/messages/${g._id}`, { text: "still here?" })).status, 403);
  await A.api("POST", `/messages/${g._id}`, { text: "after kick" });
  await never(cSock, "newMessage", (m) => m.text === "after kick", 500);
  ok("removed member is notified, loses access, and stops receiving messages");

  assert.equal((await A.api("DELETE", `/channels/${g._id}/members/${A.id}`)).status, 200);
  const afterLeave = (await B.api("GET", `/channels/${g._id}`)).data;
  assert.equal(afterLeave.admins.length, 1);
  assert.ok(afterLeave.members.map((m) => m._id).includes(afterLeave.admins[0]));
  ok("last admin leaving auto-promotes another member (group is never admin-less)");

  console.log("\nPagination");
  const pg = (await A.api("POST", "/channels/direct", { receiverId: C.id })).data;
  for (let i = 1; i <= 35; i++) await A.api("POST", `/messages/${pg._id}`, { text: `m${i}` });
  const page1 = (await A.api("GET", `/messages/${pg._id}`)).data;
  assert.equal(page1.length, 30);
  assert.equal(page1[29].text, "m35");
  const page2 = (await A.api("GET", `/messages/${pg._id}?before=${page1[0].createdAt}`)).data;
  assert.equal(page2.length, 5);
  assert.equal(page2[0].text, "m1");
  ok("cursor pagination: 30 newest, then the remaining 5 older ones in order");

  console.log("\nPresence (last device)");
  const aSock3 = await A.connect();
  for (const s of [aSock, aSock3]) s.disconnect();
  const off = await waitFor(bSock, "userOffline", (p) => p.userId === A.id);
  assert.ok(off.lastSeen);
  ok("closing the LAST device marks the user offline with lastSeen");

  [B, C, D].forEach((u) => u.sockets.forEach((s) => s.disconnect()));
  console.log(`\n✅ ${passed} checks passed\n`);
};

run().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
});
