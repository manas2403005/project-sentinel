# 🤖 Project Sentinel — Autonomous Incident Resolution Engine

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

An AI-powered DevOps system that autonomously detects, diagnoses, and fixes production incidents using Claude Code — with zero manual intervention.

---

## 🚀 [Live Demo](https://project-sentinel-pearl.vercel.app)

---

## How It Works

```
CHAOS MONKEY          DASHBOARD           CLAUDE CODE           TESTS
     │                    │                    │                  │
     ▼                    ▼                    ▼                  ▼
┌─────────┐          ┌─────────┐         ┌─────────┐        ┌─────────┐
│ Breaks  │─────────▶│ Shows   │─────────▶│ Diagnoses│───────▶│ Verify  │
│ a       │          │ CRITICAL│         │ & fixes  │        │ fix     │
│ service │          │ incident │         │ the issue│        │ passes  │
└─────────┘          └─────────┘         └─────────┘        └─────────┘
                                                                  │
                        ┌──────────────────────────────────────────┘
                        ▼
                   ┌─────────┐
                   │ RESOLVED│
                   │         │
                   └─────────┘
```

1. **Chaos Monkey** randomly breaks a service
2. **Dashboard** detects and displays CRITICAL incident
3. **Claude Code** autonomously diagnoses root cause and applies fix
4. **Regression tests** run, dashboard updates to RESOLVED

---

## Architecture

```
                                    ┌─────────────────────────────┐
                                    │      CLAUDE CODE            │
                                    │  ┌─────────┐ ┌─────────┐   │
                                    │  │  Main   │ │  Alpha  │   │
                                    │  │  Agent  │ │ Debugger│   │
                                    │  └─────────┘ └─────────┘   │
                                    │  ┌─────────┐               │
                                    │  │  Beta   │               │
                                    │  │  QA     │               │
                                    │  └─────────┘               │
                                    └──────────┬──────────────────┘
                                               │
    ┌──────────────────────────────────────────┼────────────────────────┐
    │                                          │                        │
    ▼                                          ▼                        ▼
┌──────────┐      ┌───────────────┐    ┌──────────────┐    ┌─────────────┐
│  CHAOS   │─────▶│   SERVICES    │    │  NEXT.JS     │    │  POST-MORTEM│
│  MONKEY  │      │               │    │  DASHBOARD   │    │  REPORTS    │
│          │      │  ┌─────────┐  │    │              │    │             │
│ Injects  │      │  │  SMS    │  │    │  Real-time   │    │  Incident   │
│ failures │      │  │  (3001) │  │    │  health      │    │  analysis   │
│          │      │  └─────────┘  │    │  monitoring  │    │             │
│ 6 types  │      │               │    │              │    │  docs/      │
│ of bugs  │      │  ┌─────────┐  │    │  Dark mode   │    │  *.md       │
│          │      │  │Payment │  │    │              │    │             │
│ scripts/ │      │  │ (3002) │  │    │  localhost:  │    │             │
│ chaos-*  │      │  └─────────┘  │    │  3000       │    │             │
└──────────┘      └───────┬───────┘    └──────────────┘    └─────────────┘
                           │
                           ▼
                  ┌───────────────────┐
                  │   SQLite DB       │
                  │  docs/sentinel.db │
                  │                   │
                  │ • services        │
                  │ • incidents       │
                  │ • resolution_logs │
                  │ • agent_state     │
                  └───────────────────┘
```

---

## Features

- **Real-time Monitoring** — Services report health every 5 seconds via SQLite MCP Server
- **Autonomous Bug Detection** — Multi-agent orchestration (Main + Alpha + Beta)
- **Auto-healing Sentinel** — Claude Code diagnoses and fixes without human intervention
- **6 Chaos Bug Types** — Memory leaks, timeouts, corrupt data, syntax errors, crash loops, dependency failures
- **Regression Tests** — 8/8 tests passing validate fixes don't break anything
- **Dark Mode Dashboard** — Beautiful Next.js UI with real-time status updates
- **Post-mortem Reports** — Automatic incident analysis and documentation generation

---

## Project Structure

```
sentinel/
├── .github/
│   └── workflows/           # CI/CD for Vercel deployment
├── app/                     # Next.js dashboard (port 3000)
│   └── app/
│       ├── api/
│       │   ├── agent-status/ # Sentinel agent endpoints
│       │   ├── incidents/    # Incident CRUD
│       │   └── services/     # Service health API
│       └── page.tsx          # Main dashboard
├── services/                # Microservices
│   ├── sms-service/          # SMS (port 3001)
│   │   └── *.test.ts
│   └── payment-service/      # Payment (port 3002)
│       └── *.test.ts
├── scripts/                 # Automation
│   ├── chaos-monkey.ts       # Failure injection
│   ├── sentinel-agent.ts     # Auto-resolution engine
│   └── *.ts                 # CLI utilities
├── docs/                    # Documentation & DB
│   ├── sentinel.db           # SQLite database
│   └── *.log                # Incident logs
├── CLAUDE.md                # Claude Code instructions
├── vercel.json              # Vercel config
└── README.md                # This file
```

---

## Quick Start

```bash
# Install dependencies
npm install && cd app && npm install && cd ..

# Start all services (3 terminals)
npm run start:all

# Or manually:
# Terminal 1: cd services/sms-service && npm run dev
# Terminal 2: cd services/payment-service && npm run dev
# Terminal 3: cd app && npm run dev

# Open dashboard: http://localhost:3000
```

---

## Demo Commands

```bash
# 1. Break a service (Chaos Monkey)
npm run chaos

# 2. Watch dashboard show CRITICAL
#    Then invoke Claude Code to fix:
#    "Fix the broken service. Check logs, identify bug, apply fix."

# 3. Verify resolution (tests pass)
npm test
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16 | Dashboard with real-time monitoring |
| **Styling** | Tailwind CSS v4 | Dark mode UI |
| **Backend** | Node.js + Express | Microservices |
| **Database** | SQLite | Persistent state via MCP Server |
| **Testing** | Jest | Regression tests (8/8 passing) |
| **Deployment** | Vercel | CI/CD auto-deploy from GitHub |
| **AI** | Claude Code | Autonomous diagnosis and fixing |

---

## AI-Driven Development

> **This entire project was built with zero manual coding.**

Every file — services, dashboard, chaos monkey, sentinel agent, tests, docs — was generated by describing requirements to Claude Code. No code was copied from tutorials or written by hand.

```
User: "Build an autonomous incident resolution system with:
       - Next.js dashboard
       - 2 microservices
       - Chaos Monkey
       - SQLite database
       - Multi-agent AI debugging"

Claude Code: *creates entire codebase*
User: "Commit it."
```

This is what modern software development looks like: prompt → code → tests → deploy.

---

## Database Note

The SQLite database (`docs/sentinel.db`) is local. Vercel hosts the **UI only** — it connects to a cloud SQLite instance or displays data passed from the agent. The MCP server enables Claude to query the database directly during incident resolution.

### Demo Mode

When the SQLite database is not available (production/deployed environment), the dashboard automatically switches to **Demo Mode** and displays mock data:
- Services: sms-service and payment-service show as "healthy"
- Incidents: 3 sample resolved incidents from the current day
- Sentinel Agent: "ACTIVE" status

A subtle "Demo mode - local DB not available" note appears in the footer when Demo Mode is active. This ensures the dashboard always shows a working UI even without a local database.

---

## License

MIT