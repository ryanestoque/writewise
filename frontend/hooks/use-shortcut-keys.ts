"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
const getServerSnapshot = () => false;

export function useShortcutKeys() {
  const isMac = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    modifierKey: isMac ? "⌘" : "Ctrl",
    altKey: "Alt",
  };
}
