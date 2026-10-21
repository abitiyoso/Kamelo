/** Keyboard behavior only; preserves the approved visual presentation. */
export function installMarketingKeyboard(root: HTMLElement) {
  function keydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.key === "Escape") {
      const menu = root.querySelector("#mobileMenu");
      if (menu?.classList.contains("open")) {
        (root.querySelector("#burger") as HTMLButtonElement)?.click();
        (root.querySelector("#burger") as HTMLButtonElement)?.focus();
      }
    }
    const tab = target.closest<HTMLButtonElement>('[role="tab"]');
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    const list = tab.closest('[role="tablist"]');
    const tabs = Array.from(
      list?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || [],
    );
    const index = tabs.indexOf(tab);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    const destination = tabs[next];
    if (!destination) return;
    event.preventDefault();
    const role = destination.dataset.ksRole;
    const module = destination.dataset.ksModule;
    destination.click();
    // Module navigation redraws its tab bar. Restore focus to the new tab node.
    root
      .querySelector<HTMLButtonElement>(
        role ? `[data-ks-role="${role}"]` : `[data-ks-module="${module}"]`,
      )
      ?.focus();
  }
  root.addEventListener("keydown", keydown);
  return () => root.removeEventListener("keydown", keydown);
}
