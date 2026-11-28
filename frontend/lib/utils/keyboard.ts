/**
 * Returns true when a modal dialog, confirmation alert, or dropdown menu is
 * currently open in the DOM so page-level shortcuts do not hijack overlay input.
 */
export function isBlockingOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
  );
}
