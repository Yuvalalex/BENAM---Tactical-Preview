# Changelog

All notable changes to BENAM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-03-26

### Fixed
- **T3/T4 cards crash** — `vitRow` used before declaration (temporal dead zone) caused cards to show error instead of rendering
- **"End Event" / "Reset Data" / "New Mission" crash** — null-check `tb-phase` and `tb-sub` elements that don't exist in DOM
- **Medics > AI Advisor crash** — added missing `toggleMedicAISection()` function
- **Force roster crash** — added missing `addForceMember()` function that was called but never defined
- **TQ monitor memory leak** — event payload field mismatch (`casId` vs `id`) prevented cleanup on casualty removal
- **Mesh sync reporting "0 new items"** — diff calculation happened after assignment, always yielding zero
- **Misleading variable name** — renamed `lastExportStats` to `lastImportStats` in CommsSyncFacade
- **QR sync codes unscannable** — chunk size was 900 bytes (exceeding QR capacity); reduced to 460
- **QR code too dense** — switched error correction from Level M to Level L for reliable scanning
- **QR center logo blocking data** — removed overlay that obscured code with Level L correction

### Added
- GitHub Actions CI pipeline (typecheck, build, E2E tests)
- Comprehensive E2E test suite updated for v1.1
- CONTRIBUTING.md with development guidelines
- CHANGELOG.md for version tracking

### Changed
- Updated package.json with proper metadata (description, author, keywords)

## [1.0.0] - 2026-03-20

### Added
- Initial release of BENAM tactical medical PWA
- Role-based setup (commander, medic, doctor, paramedic)
- Mission lifecycle management (prep, active, post)
- Real-time casualty management with MARCH protocol
- Fire mode for under-fire triage
- AI advisor (offline, rules-based) for treatment recommendations
- QR-based mesh sync for multi-device data sharing
- Blood compatibility management
- CASEVAC/evacuation pipeline with scoring
- Mass sort (rapid triage) mode
- Swipe focus mode for sequential patient review
- Timeline logging and AAR generation
- Clinical protocols library
- Offline-first PWA with Service Worker
- Android APK via Capacitor
- RTL Hebrew interface
- Playwright E2E test suite
