import { create } from "zustand";

// A minimal, dependency-free toast system. Each toast auto-dismisses
// after a few seconds; no external library needed for something this
// small, which also keeps the published-page bundle lean.
let idCounter = 0;

export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = "error") => {
    const id = ++idCounter;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
