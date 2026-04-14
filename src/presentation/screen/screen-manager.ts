/**
 * ScreenManager — TypeScript wrapper for legacy screen navigation.
 *
 * Delegates to legacy goScreen() / setNav() while adding:
 * - Navigation history stack
 * - EventBus emission on screen change
 * - Typed screen ID tracking
 * - Back navigation support
 */

import type { EventBus } from '../../core/events';

/** Known screen IDs from index.html. Extensible via string type. */
export type ScreenId = string;

/** Screen-to-nav-index mapping for bottom nav bar. */
const SCREEN_NAV_INDEX: Record<string, number> = {
  'sc-prep': 0,
  'sc-war': 1,
  'sc-stats': 2,
};

export class ScreenManager {
  private readonly eventBus: EventBus;
  private readonly history: ScreenId[] = [];
  private currentScreen: ScreenId = '';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize by detecting the currently active screen.
   * Call after legacy code has rendered the initial view.
   */
  init(): void {
    this.currentScreen = this.detectActiveScreen();
    if (this.currentScreen) {
      this.history.push(this.currentScreen);
    }
  }

  /** Navigate to a screen by ID. Delegates to legacy goScreen(). */
  navigate(screenId: ScreenId): void {
    const from = this.currentScreen;
    if (screenId === from) return;

    this.callLegacyGoScreen(screenId);
    this.updateNavBar(screenId);
    this.currentScreen = screenId;
    this.history.push(screenId);
    this.eventBus.emit('screen:changed', { from, to: screenId });
  }

  /** Go back to the previous screen. Returns false if no history. */
  goBack(): boolean {
    if (this.history.length < 2) return false;
    this.history.pop(); // Remove current
    const previous = this.history[this.history.length - 1];
    const from = this.currentScreen;
    this.callLegacyGoScreen(previous);
    this.updateNavBar(previous);
    this.currentScreen = previous;
    this.eventBus.emit('screen:changed', { from, to: previous });
    return true;
  }

  /** Get the current screen ID. */
  getCurrentScreen(): ScreenId {
    return this.currentScreen;
  }

  /** Get a copy of the navigation history stack. */
  getHistory(): readonly ScreenId[] {
    return [...this.history];
  }

  /** Clear navigation history (e.g., on mission reset). */
  clearHistory(): void {
    this.history.length = 0;
    if (this.currentScreen) {
      this.history.push(this.currentScreen);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private detectActiveScreen(): ScreenId {
    const el = document.querySelector('.screen.active');
    return el?.id ?? '';
  }

  private callLegacyGoScreen(screenId: ScreenId): void {
    if (typeof window.goScreen === 'function') {
      window.goScreen(screenId);
    }
  }

  private updateNavBar(screenId: ScreenId): void {
    const index = SCREEN_NAV_INDEX[screenId];
    if (index !== undefined && typeof window.setNav === 'function') {
      window.setNav(index);
    }
  }
}
