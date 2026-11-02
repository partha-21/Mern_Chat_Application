// Dependency-free emoji grid. Closes when an emoji is picked or when the
// backdrop is clicked.
const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🤔","😴","😅","😉",
  "🙂","🙃","😇","🥳","😭","😢","😡","🤯","😱","🥺","🤗","🙄",
  "👍","👎","👏","🙌","🙏","💪","👀","🤝","👋","✌️","🤞","🫡",
  "❤️","🧡","💛","💚","💙","💜","🔥","✨","🎉","💯","✅","❌",
  "🚀","💡","📌","📎","📷","🎵","☕","🍕","🎂","🌟","⚡","🌈",
];

const EmojiPicker = ({ onPick, onClose }) => (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} />
    <div className="absolute bottom-full left-0 mb-2 z-40 w-72 bg-panel border border-line rounded-xl p-2 shadow-xl grid grid-cols-8 gap-0.5">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="h-8 rounded-md hover:bg-raised text-lg leading-none transition"
        >
          {emoji}
        </button>
      ))}
    </div>
  </>
);

export default EmojiPicker;
