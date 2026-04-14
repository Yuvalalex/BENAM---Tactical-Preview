/**
 * ActionDelegator — Centralized event delegation for UI actions.
 *
 * Replaces inline onclick handlers with a single document-level
 * click listener that dispatches to registered handlers based on
 * the `data-action` attribute.
 *
 * Phase 4: Registers infrastructure only. Bulk onclick migration
 * from legacy code happens in Phase 8.
 *
 * Usage in HTML:
 *   <button data-action="startMission">Start</button>
 *
 * Usage in TypeScript:
 *   delegator.register('startMission', () => startMission());
 */

/** Handler function for a delegated action. */
export type ActionHandler = (
  event: MouseEvent,
  element: HTMLElement,
) => void | Promise<void>;

export class ActionDelegator {
  private readonly handlers = new Map<string, ActionHandler>();
  private boundHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Register a handler for a named action.
   * Overwrites any previously registered handler for the same name.
   */
  register(name: string, handler: ActionHandler): void {
    this.handlers.set(name, handler);
  }

  /** Register multiple handlers at once from a record. */
  registerMany(actions: Record<string, ActionHandler>): void {
    for (const [name, handler] of Object.entries(actions)) {
      this.handlers.set(name, handler);
    }
  }

  /** Check if a handler is registered for the given action name. */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /** Get a list of all registered action names. */
  getRegistered(): string[] {
    return [...this.handlers.keys()];
  }

  /**
   * Attach the global click listener to the document.
   * Call once during app initialization.
   */
  init(): void {
    if (this.boundHandler) return;
    this.boundHandler = (e: MouseEvent) => this.handleClick(e);
    document.addEventListener('click', this.boundHandler, true);
  }

  /** Remove the global click listener and clear all handlers. */
  destroy(): void {
    if (this.boundHandler) {
      document.removeEventListener('click', this.boundHandler, true);
      this.boundHandler = null;
    }
    this.handlers.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Walk up the DOM to find the closest [data-action] element
    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const actionName = actionEl.dataset.action;
    if (!actionName) return;

    const handler = this.handlers.get(actionName);
    if (handler) {
      handler(event, actionEl);
    } else {
      console.warn(
        `[ActionDelegator] No handler for action: "${actionName}"`,
      );
    }
  }
}
