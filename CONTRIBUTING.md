# Contributing to BENAM

Thanks for your interest in contributing to BENAM! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Yuvalalex/BENAM---Tactical-Preview.git
cd BENAM---Tactical-Preview
npm install

# Start dev server
npm run dev
```

## Project Structure

```
├── index.html              # Single-page app entry
├── js/parts/               # Legacy vanilla JS modules (auto-concatenated)
│   ├── 01-state.js         # Global state & persistence
│   ├── 05-helpers-setup.js # Core helpers & role setup
│   ├── 06-navigation.js    # Screen navigation
│   ├── 09-mission.js       # Mission lifecycle
│   ├── 10-war-room.js      # War room rendering
│   └── ...                 # 30+ feature modules
├── src/                    # Modern TypeScript layer
│   ├── core/               # DI container, types, events
│   ├── domain/             # Business logic & services
│   ├── data/               # Storage adapters
│   ├── features/           # Feature facades
│   ├── presentation/       # UI store & screen manager
│   └── background/         # Background services
├── tests/                  # Playwright E2E tests
├── android/                # Capacitor Android project
└── vite.config.ts          # Build config with custom plugins
```

### Architecture Notes

The project uses a **hybrid architecture**:

- **Legacy JS** (`js/parts/*.js`) — Numbered files are auto-concatenated by Vite into `app.js` (01-33) and `enhancements.js` (34+). This is the runtime UI layer.
- **Modern TypeScript** (`src/`) — Clean architecture with DI, typed events, and domain services. Gradually replacing legacy code.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `www/` |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run Playwright E2E tests |
| `./build_apk.sh` | Build Android debug APK |

## Testing

We use [Playwright](https://playwright.dev/) for end-to-end testing:

```bash
# Install browsers (first time only)
npx playwright install chromium

# Run all tests
npm test

# Run specific test file
npx playwright test tests/smoke.spec.js

# Run with UI mode
npx playwright test --ui
```

### Writing Tests

- Tests live in `tests/` directory
- Use `*.spec.js` naming convention
- Tests run against the Vite dev server (auto-started by Playwright)
- All tests run in Hebrew locale (`he-IL`) for RTL validation
- Use `page.evaluate()` to call app functions directly

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Ensure `npm run typecheck` passes with 0 errors
3. Ensure `npm run build` succeeds
4. Run `npm test` and verify all tests pass
5. Write clear commit messages describing the "why"
6. Keep PRs focused — one feature or fix per PR

## Code Style

- **JavaScript (legacy):** No semicolons, single quotes, 2-space indent
- **TypeScript:** Strict mode, explicit types on public APIs
- **CSS:** CSS custom properties (variables) for theming
- **HTML:** RTL-first, Hebrew UI text

## Reporting Issues

Use [GitHub Issues](https://github.com/Yuvalalex/BENAM---Tactical-Preview/issues) to report bugs or request features. Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/device info
- Screenshots if applicable
