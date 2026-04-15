<div align="center">

# BENAM - Battlefield Emergency Network & Aid Manager
**// Tactical Medical Incident Management — 100% Offline**

![offline 100%](https://img.shields.io/badge/offline-100%25-success)
![PWA ready](https://img.shields.io/badge/PWA-ready-success)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)
![v1.2.0](https://img.shields.io/badge/version-1.2.0-blue)
![E2E Playwright](https://img.shields.io/badge/E2E-Playwright-yellowgreen)
![RTL Hebrew](https://img.shields.io/badge/RTL-Hebrew-orange)
![Android APK](https://img.shields.io/badge/Android-APK-success)
![ISC License](https://img.shields.io/badge/License-ISC-red)

*"From commander to medic — one tool, the whole incident, no internet."*

<br>

## 📢 [Click here to view the full BENAM Presentation Deck!](https://docs.google.com/presentation/d/1dOmADFgqdxe--yQ07pob6icAYKNHVX6_DnLUm9n2ZiU/edit?usp=sharing) 📽️

</div>

---

## Overview

**What is BENAM?**  
BENAM is a tactical medical management system (PWA) built for combat medical teams. It accompanies the team from pre-mission preparation, through active combat incident management in real time, to a final summary report and debrief — with **zero dependency on internet, servers, or any external infrastructure.**

## User Workflow

1. **PIN Lock** 
2. **Role Setup** 
3. **PREP** 
4. **WAR Mode** (Casualty Card → MARCH Tracker → Vitals History → Treatment Log → Evac Queue) 
5. **Report** 
6. **AAR/Stats**

---

## Core Capabilities / Feature Set

* 🎖 **Role & Mission Mgmt** - 4 roles (Commander, Medic, Paramedic, Physician), 2 operation modes, 5 mission types, automatic gear presets per role.
* ⚔️ **Active Incident (WAR Mode)** - Dedicated Fire Mode with minimalist UI, Next Action Engine (NAE) algorithm, Golden Hour countdown, SA Pulse checks, reassessment reminders.
* 🩹 **Full Casualty Management** - 4-level triage (T1–T4), full casualty profile, MARCH tracker per patient, vitals history, QR codes, digital triage tags, injury photo capture.
* 🤖 **AI Advisor — Offline** - Rule-based smart analysis without internet. Detects TQ over 30 min, missing TXA, untreated airways, hypothermia risk. Scores each action 0–100 by clinical urgency.
* 🚁 **CASEVAC Management** - Auto-generates 9-LINE MEDEVAC orders, dynamic evacuation queue with priority scoring, LZ management, evac packages, crew assignment.
* 🌳 **Clinical Protocols Library** - Built-in MARCH Decision Tree, SABCDE (IDF standard), PFC, Blast/IED, Crush Syndrome, Hypothermia, and more — step-by-step guidance.
* 💉 **Advanced Medical Mgmt** - Blood bank with T-COAG compatibility matrix, weight-based dosage calculator (Morphine, Ketamine, TXA), supply inventory tracking.
* 📡 **Comms & Documentation** - Comms log, Radio Script Generator, Pre-Mission Brief auto-doc, Hebrew voice input (STT he-IL), Mesh Sync via QR chunking between devices.
* 📊 **Analytics & Debrief** - KPI dashboard, Gantt chart of all casualties and treatment events, full timeline, Hero Score for team performance, AAR structured support.
* 🌙 **Field UX** - Night mode (red display), PIN lock, one-handed navigation, haptic feedback for critical alerts (TQ, Golden Hour), non-blocking toast notifications.

---

## Architecture

**Project Structure**  
Hybrid architecture — Legacy JS layer (~23,500 lines) alongside a modern TypeScript layer (~5,300 lines) with Dependency Injection, Domain Services, and Background Tasks.

```text
BENAM---Tactical-Preview/
├── index.html            # Full SPA 
├── manifest.json         # PWA manifest (standalone, RTL, he)
├── sw.js                 # Service Worker — cache + offline
├── js/
│   ├── app.js            # Core engine 
│   ├── enhancements.js   # Feature extensions 
│   └── parts/            # 41 functional modules 
│       ├── 01-state.js         # State management
│       ├── 10-war-room.js      # War Room engine
│       ├── 17-buddy-voice-algo.js  # Voice input (he-IL STT)
│       ├── 19..22-qr-*.js      # QR export/scan/sync
│       ├── 25-mesh-sync*.js    # Mesh networking & sync
│       ├── 34-enh-fire-ai.js   # AI Advisor engine
│       └── 38..41-enh-idb/audio# IndexedDB + voice recording
├── src/                  # TypeScript layer (64 files)
│   ├── core/             # DI container, types, constants
│   ├── domain/           # Domain services & business logic
│   ├── features/         # casualty, triage, evacuation, comms
│   ├── background/       # TQ monitor, Golden Hour, SA Pulse
│   └── presentation/     # UI components & view layer
├── tests/                # 7 Playwright E2E test suites
└── .github/workflows/    # CI: typecheck → build → E2E
```

## Data Model

Data is stored locally in the browser. IndexedDB is the primary persistence layer; localStorage serves as a fallback. No data is sent to external servers.

```javascript
State = {
  force:        [],   // Personnel + personal equipment
  casualties:   [],   // Patients + MARCH + vitals + treatments
  timeline:     [],   // Chronological log of all events
  comms:        {},   // Communications & mission params
  commsLog:     [],   // Radio transmission log
  supplies:     {},   // Medical supply inventory
  missionStart: timestamp,  // Golden Hour anchor
  role / opMode / missionType
}
```

---

## Quick Start

### Install & Run
```bash
git clone https://github.com/Yuvalalex/BENAM---Tactical-Preview.git
cd BENAM---Tactical-Preview
npm install
npm run dev       # → http://localhost:8080
```

### Development
```bash
npm run typecheck  # TypeScript strict validation
npm test           # Playwright E2E tests
npm run build      # Production build
./build_apk.sh     # Android APK → android/app/build/outputs/apk/debug/
```

*Running via local server is preferred over opening index.html directly — required for Service Worker, PWA install, camera access, and Playwright validation.*

### PWA Installation
- **Android**: Chrome menu ⋮ → "Add to Home Screen"
- **iOS**: Safari Share ⬆ → "Add to Home Screen"
- **Desktop**: Chrome ⊕ icon in address bar → "Install"

---

## Screens

| Screen | ID | Description |
|---|---|---|
| **Role Selection** | `sc-role` | Set role, mode, and mission type — app entry point |
| **Pre-Mission Prep** | `sc-prep` | Force management, comms setup, Pre-Mission Brief |
| **Active Incident** | `sc-war` | War Room — all casualties, AI Advisor, NAE |
| **Fire Mode** | `sc-fire` | MARCH buttons, minimalist combat interface |
| **Casualty** | `sc-cas` | Individual casualty management |
| **Blood Bank** | `sc-blood` | Compatibility matrix, inventory tracking |
| **Report & Evac** | `sc-report` | 9-LINE, Evac Priority, QR export, KPI summary |
| **Debrief / Stats** | `sc-stats` | Statistics, Gantt chart, Hero Score |
| **Timeline** | `sc-timeline` | Full chronological incident log |

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | HTML5 + CSS3 + Vanilla JS | No frameworks — fast & portable |
| **TypeScript** | Strict mode, DI Container | Domain services, background tasks |
| **Build** | Vite | HMR, TS compilation, bundling |
| **Offline** | Service Worker (Cache API) | 100% offline-first |
| **Storage** | IndexedDB + localStorage | Local persistence, no backend |
| **Voice** | Web Speech API (he-IL) | Hebrew voice input + audio recording |
| **QR / Sync** | Canvas QR + Mesh chunking | No external libs, inter-device sync |
| **Tests** | Playwright | 7 E2E suites |
| **CI/CD** | GitHub Actions | typecheck → build → E2E |
| **Mobile** | PWA + Android APK | Standalone, RTL, he locale |

---

## Privacy & Security

- ✓ **Zero servers** — data never leaves the device
- ✓ **Zero API calls** — not a single network request
- ✓ **Zero telemetry** — no tracking, analytics, or external logs
- ✓ **PIN Lock** — access protection for sensitive patient data

---

## Contributing

### Contribution Workflow

```bash
# 1. Fork + Clone
git clone https://github.com/YOUR_USERNAME/BENAM---Tactical-Preview.git

# 2. New branch
git checkout -b feature/my-feature

# 3. Test before commit
npm test

# 4. Push + Pull Request
git push origin feature/my-feature
```

**Key Rules:**
- **RULE 01**: Every new feature must work 100% offline.
- **RULE 02**: UI must be RTL, Hebrew-compatible, and touch-friendly.
- **RULE 03**: No new external dependencies without prior discussion.

---

## About
**BENAM**  
*Built for the field. Works without the cloud.*  
ISC License © Yuvalalex

- [Report a bug](https://github.com/Yuvalalex/BENAM---Tactical-Preview/issues)
- [Presentation deck](https://docs.google.com/presentation/d/1dOmADFgqdxe--yQ07pob6icAYKNHVX6_DnLUm9n2ZiU/edit?usp=sharing)
