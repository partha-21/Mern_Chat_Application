// Unit tests for the chat store's reducers (no browser, no server).
import assert from "node:assert/strict";
globalThis.document = { visibilityState: "visible" };
import { useChatStore } from "../src/store/useChatStore.js";
import { useAuthStore } from "../src/store/useAuthStore.js";

let passed = 0;
const ok = (n) => { passed++; console.log("  ✓", n); };
const user = (id, name) => ({ _id: id, fullName: name });
const msg = (id, channelId, sender, extra = {}) => ({
  _id: id, channelId, senderId: sender, text: `text-${id}`, seenBy: [sender._id],
  reactions: [], createdAt: new Date().toISOString(), ...extra,
});
const S = () => useChatStore.getState();
const chan = (id, extra = {}) => ({
  _id: id, type: "direct", members: [], unreadCount: 0, lastMessage: null,
  updatedAt: "2024-01-01T00:00:00.000Z", ...extra,
});

const me = user("me", "Me"), bob = user("bob", "Bob");
const fresh = (state = {}) => {
  useAuthStore.setState({ authUser: me });
  useChatStore.setState({ ...S(), channels: [chan("A"), chan("B")], messages: [], selectedChannelId: "A", typing: {}, ...state });
};

console.log("\nIncoming messages");
fresh();
S().applyIncomingMessage(msg("m1", "B", bob));
assert.equal(S().channels.find((c) => c._id === "B").unreadCount, 1);
assert.equal(S().channels[0]._id, "B");
assert.equal(S().channels[0].lastMessage._id, "m1");
assert.equal(S().messages.length, 0);
ok("message in a closed chat: unread +1, chat jumps to top, preview updated, open chat untouched");

S().applyIncomingMessage(msg("m2", "A", bob));
assert.equal(S().messages.length, 1);
assert.equal(S().channels.find((c) => c._id === "A").unreadCount, 0);
ok("message in the OPEN chat (tab visible): appended, no unread");

S().applyIncomingMessage(msg("m2", "A", bob));
assert.equal(S().messages.length, 1);
ok("duplicate delivery (HTTP response + socket echo) is de-duplicated");

S().applyIncomingMessage(msg("m3", "A", me));
assert.equal(S().channels.find((c) => c._id === "A").unreadCount, 0);
ok("my own message never creates unread");

document.visibilityState = "hidden";
S().applyIncomingMessage(msg("m4", "A", bob));
assert.equal(S().channels.find((c) => c._id === "A").unreadCount, 1);
document.visibilityState = "visible";
ok("open chat but tab hidden: counts as unread (Telegram behaviour)");

console.log("\nRead ticks, edit, delete, react");
fresh({ messages: [msg("o1", "A", me), msg("b1", "A", bob)] });
S().applySeen({ channelId: "A", userId: "bob" });
assert.ok(S().messages[0].seenBy.includes("bob"));
assert.ok(!S().messages[1].seenBy.includes("me"));
ok("someone reading the chat marks MY messages seen, not theirs");

S().applyEdit({ _id: "o1", text: "changed", editedAt: "2024-02-02T00:00:00.000Z" });
assert.equal(S().messages[0].text, "changed");
assert.ok(S().messages[0].editedAt);
ok("edit updates text + editedAt");

fresh({
  messages: [msg("x1", "A", bob), msg("x2", "A", me, { replyTo: { _id: "x1", text: "text-x1", senderId: bob } })],
  channels: [chan("A", { lastMessage: msg("x1", "A", bob) })],
});
S().applyDelete({ _id: "x1" });
assert.equal(S().messages[0].isDeleted, true);
assert.equal(S().messages[0].text, "");
assert.equal(S().messages[1].replyTo.isDeleted, true);
assert.equal(S().channels[0].lastMessage.isDeleted, true);
ok("delete wipes the message, the quote of it in replies, and the chat-list preview");

S().applyReactions({ _id: "x2", reactions: [{ emoji: "👍", userId: "bob" }] });
assert.equal(S().messages[1].reactions[0].emoji, "👍");
ok("reactions replace on the target message");

console.log("\nChannel lifecycle + typing");
fresh({ messages: [msg("z", "A", bob)], infoOpen: true });
S().applyChannelRemoved("A");
assert.equal(S().selectedChannelId, null);
assert.equal(S().messages.length, 0);
assert.equal(S().channels.some((c) => c._id === "A"), false);
ok("being removed from the open chat closes it and drops it from the list");

fresh({ typing: { A: { bob: "Bob", carol: "Carol" } } });
S().clearTyping("A", "bob");
assert.deepEqual(S().typing.A, { carol: "Carol" });
ok("clearing one typer leaves the others");

fresh({ messages: [msg("q", "A", bob)], replyingTo: msg("q", "A", bob) });
S().setEditing(msg("q", "A", me));
assert.equal(S().replyingTo, null);
S().setReplyingTo(msg("q", "A", bob));
assert.equal(S().editing, null);
ok("reply and edit modes are mutually exclusive");

S().selectChannel("B");
assert.equal(S().selectedChannelId, "B");
assert.deepEqual([S().messages.length, S().replyingTo, S().editing], [0, null, null]);
ok("switching chats clears messages and composer modes");

console.log(`\n✅ ${passed} store checks passed\n`);
process.exit(0);
