const NoChatSelected = () => (
  <div className="flex-1 flex flex-col items-center justify-center h-full px-6 text-center">
    <div className="relative mb-5">
      <span className="absolute inset-0 rounded-full bg-signal/10 animate-ping-slow" />
      <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-raised border border-line text-2xl">
        📡
      </span>
    </div>
    <p className="font-display font-semibold text-frost mb-1">Select a chat to start messaging</p>
    <p className="text-sm text-mist max-w-xs">
      Pick a conversation on the left, or choose someone under “People” to say hello.
    </p>
  </div>
);

export default NoChatSelected;
