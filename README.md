<div align="center">

# Battlefield Emergency Network & Aid Manager (BENAM)
### Offline-First Tactical Incident Management PWA

![offline 100%](https://img.shields.io/badge/offline-100%25-success)
![PWA ready](https://img.shields.io/badge/PWA-ready-success)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)
![version](https://img.shields.io/badge/version-1.1.0-blue)
![Playwright E2E](https://img.shields.io/badge/Playwright-E2E%20passing-success)
![E2E Playwright](https://img.shields.io/badge/E2E-Playwright-yellowgreen)
![RTL Hebrew](https://img.shields.io/badge/RTL-Hebrew-orange)
![Android APK](https://img.shields.io/badge/Android-APK-success)
![License ISC](https://img.shields.io/badge/License-ISC-red)

BENAM is a local-first field operations web app for handling mission setup, casualty tracking, evacuation flow, reporting, and offline data transfer without a cloud dependency.

[View the BENAM presentation deck](https://docs.google.com/presentation/d/1dOmADFgqdxe--yQ07pob6icAYKNHVX6_DnLUm9n2ZiU/edit?usp=sharing)

</div>

---

## Why This Repo Is Worth Reviewing

- Offline-first PWA with no backend dependency for core workflows
- Full Playwright E2E test suite covering major user flows and regression scenarios
- Hybrid legacy JavaScript plus modular TypeScript migration in a real working product
- Android packaging support through Capacitor
- RTL/Hebrew interface with touch-oriented field UX

## Overview

BENAM is a single-repository application for field incident management. It covers the operational flow from setup and readiness, through active casualty handling and prioritization, to report generation and offline transfer.

From an engineering perspective, the value of this repository is not just the feature list. It shows how a state-heavy browser application can support offline operation, structured workflow handling, mobile packaging, regression coverage, and a gradual migration from legacy JavaScript to stricter TypeScript modules.

## What This Repository Demonstrates

- Stateful single-page application design with a large UI surface area
- Offline persistence using IndexedDB, localStorage fallback, Service Worker, and PWA metadata
- Complex user workflows including triage, casualty detail handling, reporting, and QR-based sync/export flows
- UI support for RTL/Hebrew environments and touch-first interaction
- End-to-end verification with Playwright and CI automation
- Android delivery path via Capacitor and Gradle build tooling

## Audience

- Recruiters and technical evaluators reviewing product thinking and engineering execution
- Engineers assessing architecture, testing discipline, and maintainability in a hybrid codebase
- Reviewers looking at offline-first UX, delivery readiness, and end-to-end workflow coverage

---

## Core Product Flow

1. PIN lock and app entry
2. Role and mission setup
3. Pre-mission preparation
4. WAR mode casualty operations
5. Report and evacuation outputs
6. Debrief and analytics screens

This flow is reflected directly in the application screens and test coverage.

---

## Core Capabilities

- Mission setup, readiness checks, and team context configuration
- Casualty tracking with triage, MARCH-oriented actions, vitals snapshots, and timeline history
- Evacuation support, prioritization, and structured report generation
- QR-based export/import and mesh-style sync workflows for constrained connectivity environments
- Touch-first RTL/Hebrew UX for field usage
- Local-only persistence with no required backend for baseline operation

## Architecture Snapshot

Hybrid codebase:
- Legacy runtime in [js](js)
- Newer modular code in [src](src)
- Browser shell in [index.html](index.html)
- Android packaging in [android](android)
- E2E coverage in [tests](tests)

Key repository signals:
- Large real-world UI runtime in [js/app.js](js/app.js)
- Incremental TypeScript architecture in [src](src)
- CI workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Playwright regression coverage via [playwright.config.js](playwright.config.js)

## Quick Start

### Prerequisites

- Node.js and npm
- A Chromium-based browser for local validation
- Optional: Android Studio and SDK for APK builds

### Install

```bash
git clone https://github.com/Yuvalalex/BENAM---Tactical-Preview.git
cd BENAM---Tactical-Preview
npm install
```

### Run Locally

```bash
npm run dev
```

Optional legacy static server:

```bash
npm run dev:legacy
```

### Validate

```bash
npm run typecheck
npm run build
npm test
```

### Build Android APK

```bash
./build_apk.sh
```

Release build:

```bash
./build_apk.sh release
```

## Testing And CI

The repository includes GitHub Actions CI for:
- TypeScript check
- Production build
- Playwright E2E tests

Main scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run dev:legacy` | Start a static server on port 8080 |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production bundle |
| `npm run typecheck` | Run TypeScript with no emit |
| `npm test` | Run Playwright end-to-end tests |
| `npm run test:ci` | Run Playwright with GitHub reporter |

## Public Safety Boundary

BENAM is presented here as a technical project and workflow tool.
This repository is not presented as a regulated clinical decision system, a certified medical product, or a substitute for formal medical command, training, or protocol authority.


## Additional Project Docs

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- [CHANGELOG.md](CHANGELOG.md)

## License

ISC. See [LICENSE](LICENSE).

## Links

- Repository: https://github.com/Yuvalalex/BENAM---Tactical-Preview
- Issues: https://github.com/Yuvalalex/BENAM---Tactical-Preview/issues
- Presentation deck: https://docs.google.com/presentation/d/1dOmADFgqdxe--yQ07pob6icAYKNHVX6_DnLUm9n2ZiU/edit?usp=sharing
