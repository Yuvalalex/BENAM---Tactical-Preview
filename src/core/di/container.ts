/**
 * Lightweight Dependency Injection container.
 *
 * Supports singleton and transient registrations with typed resolution.
 * No external dependencies — designed for a tactical offline PWA where
 * bundle size and cold-start time matter.
 *
 * Usage:
 *   container.registerSingleton('TriageService', () => new TriageService());
 *   const svc = container.resolve<TriageService>('TriageService');
 */

type Factory<T> = () => T;

interface Registration<T = unknown> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

class DIContainer {
  private registrations = new Map<string, Registration>();

  /**
   * Register a singleton service.
   * Factory is called once on first resolve; subsequent resolves return the same instance.
   */
  registerSingleton<T>(token: string, factory: Factory<T>): void {
    if (this.registrations.has(token)) {
      console.warn(`[DI] Overwriting existing registration: ${token}`);
    }
    this.registrations.set(token, { factory, singleton: true });
  }

  /**
   * Register a transient service.
   * Factory is called on every resolve, producing a new instance each time.
   */
  registerTransient<T>(token: string, factory: Factory<T>): void {
    if (this.registrations.has(token)) {
      console.warn(`[DI] Overwriting existing registration: ${token}`);
    }
    this.registrations.set(token, { factory, singleton: false });
  }

  /**
   * Register a pre-created instance as a singleton.
   */
  registerInstance<T>(token: string, instance: T): void {
    this.registrations.set(token, {
      factory: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Resolve a registered service by token.
   * Throws if the token has not been registered.
   */
  resolve<T>(token: string): T {
    const reg = this.registrations.get(token);
    if (!reg) {
      throw new Error(`[DI] No registration found for token: ${token}`);
    }

    if (reg.singleton) {
      if (reg.instance === undefined) {
        reg.instance = reg.factory();
      }
      return reg.instance as T;
    }

    return reg.factory() as T;
  }

  /**
   * Check whether a token has been registered.
   */
  has(token: string): boolean {
    return this.registrations.has(token);
  }

  /**
   * Remove a registration (useful for testing or hot-swapping).
   */
  unregister(token: string): boolean {
    return this.registrations.delete(token);
  }

  /**
   * Remove all registrations. Primarily used in tests.
   */
  reset(): void {
    this.registrations.clear();
  }

  /**
   * List all registered tokens (for debugging).
   */
  listTokens(): string[] {
    return Array.from(this.registrations.keys());
  }
}

/**
 * Global container singleton.
 * All modules register against and resolve from this shared instance.
 */
export const container = new DIContainer();

export type { DIContainer };
