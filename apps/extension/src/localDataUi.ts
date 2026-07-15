import { setNoteState, setSaveButtonState } from "./render";

export const CLEAR_LOCAL_DATA_CONFIRMATION =
  "Clear all local ForumForge user data from this browser? This permanently deletes read history, saved posts, and private author notes. This cannot be undone.";
export const CLEAR_LOCAL_DATA_PROGRESS = "Clearing read history, saved posts, and notes…";
export const CLEAR_LOCAL_DATA_SUCCESS =
  "Cleared read history, saved posts, and private author notes.";
export const CLEAR_LOCAL_DATA_FAILURE =
  "Couldn't clear all local data. Some data may remain; reread the thread or try again.";

/** Injectable confirmation seam: production uses the browser's native dialog. */
export function confirmClearLocalData(confirm: (message: string) => boolean): boolean {
  return confirm(CLEAR_LOCAL_DATA_CONFIRMATION);
}

export type ClearLocalDataOutcome = "cancelled" | "cleared" | "failed";

export type ClearLocalDataActions = {
  confirm(message: string): boolean;
  clear(): Promise<void>;
  onStart(): void;
  onSuccess(): void;
  onFailure(error: unknown): void;
  onFinish(outcome: Exclude<ClearLocalDataOutcome, "cancelled">): void;
};

/** Testable orchestration for confirmation and asynchronous clear UI states. */
export async function runClearLocalData(
  actions: ClearLocalDataActions,
): Promise<ClearLocalDataOutcome> {
  if (!confirmClearLocalData(actions.confirm)) return "cancelled";

  actions.onStart();
  let outcome: Exclude<ClearLocalDataOutcome, "cancelled"> = "failed";
  try {
    await actions.clear();
    actions.onSuccess();
    outcome = "cleared";
  } catch (error) {
    actions.onFailure(error);
  } finally {
    actions.onFinish(outcome);
  }
  return outcome;
}

/** Enable or disable every rendered control that can persist user data. */
export function setRenderedPersistenceControlsDisabled(
  root: ParentNode,
  disabled: boolean,
): void {
  for (const control of root.querySelectorAll<
    HTMLButtonElement | HTMLTextAreaElement
  >(".ff-post__save, .ff-post__note-toggle, .ff-post__note-save, .ff-post__note-input")) {
    control.disabled = disabled;
  }
}

/**
 * Remove every rendered cue derived from data that has just been deleted while
 * keeping the extracted thread itself available to read and save again.
 */
export function resetRenderedLocalData(root: ParentNode): void {
  for (const badge of root.querySelectorAll<HTMLElement>(".ff-post__new")) badge.remove();

  for (const post of root.querySelectorAll<HTMLElement>(".ff-post")) {
    post.removeAttribute("data-new");
    setNoteState(post, "");

    const save = post.querySelector<HTMLElement>(".ff-post__save");
    if (save) setSaveButtonState(save, false);

    const editor = post.querySelector<HTMLElement>(".ff-post__note");
    if (editor) editor.hidden = true;

    const toggle = post.querySelector<HTMLElement>(".ff-post__note-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
}
