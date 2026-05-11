# Project Sentinel

### Autonomous Incident Resolution Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)

---

## What is Project Sentinel?

Project Sentinel is an **autonomous incident resolution system** that monitors microservices, automatically detects failures injected by Chaos Monkey, and heals itself without human intervention. Think of it as a self-healing nervous system for your infrastructure.

```
┌──────────────┐     ┌───────────┐     ┌──────────┐     ┌─────────────────┐
│  CHAOS       │     │  SERVICES │     │  SQLite  │     │  SENTINEL       │
│  MONKEY      │────▶│  (sms,     │────▶│  DB      │────▶│  AGENT          │
│  (injects    │     │  payment) │     │  (tracks │     │  (analyzes &    │
│  failures)   │     │           │     │  health) │     │  decides)      │
└──────────────┘     └───────────┘     └──────────┘     └────────┬────────┘
                                                                  │
                         ┌──────────────────┐                   │
                         │  DASHBOARD       │◀──────────────────┘
                         │  (shows status   │        (auto-heals)
                         │   & logs)        │
                         └──────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Real-time Monitoring** | Services report health every 5 seconds to SQLite |
| **Autonomous Detection** | Chaos Monkey randomly injects bugs to test the system |
| **Auto-healing** | Sentinel Agent analyzes incidents and applies fixes |
| **Persistent Storage** | SQLite tracks all incidents, services, and resolution history |
| **Zero Downtime** | Failures are detected and resolved automatically |
| **Regression Tests** | 8 passing tests ensure services stay healthy |
| **Dark Mode Dashboard** | Beautiful Next.js UI showing service status in real-time |

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 8+

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure

```bash
# Start SQLite database (via Next.js app)
cd app && npm install && cd ..
```

### 3. Start All Services

```bash
# Terminal 1: Start SMS Service (port 3001)
cd services/sms-service && npm run dev

# Terminal 2: Start Payment Service (port 3002)
cd services/payment-service && npm run dev

# Terminal 3: Start Dashboard (port 3000)
cd app && npm run dev
```

**Or use the convenience script:**

```bash
npm run start:all
```

### 4. Open Dashboard

Navigate to: [http://localhost:3000](http://localhost:3000)

---

## Chaos Monkey

The Chaos Monkey randomly injects failures to test Sentinel's autonomous resolution capabilities.

### Run Chaos Monkey

```bash
npm run chaos
```

### What Chaos Monkey Does:
- Randomly marks services as "broken"
- Simulates network timeouts and database errors
- Triggers incident creation in SQLite
- Tests the autonomous resolution pipeline

---

## Testing

### Run All Tests

```bash
npm test
```

### Expected Output

```
PASS services/sms-service/sms-service.test.ts
PASS services/payment-service/payment-service.test.ts

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

### Test Coverage

| Service | Tests |
|---------|-------|
| SMS Service | Health endpoint, Express dependency, TypeScript compilation |
| Payment Service | Health endpoint, Express dependency, TypeScript compilation |

---

## Project Structure

```
project-sentinel/
├── app/                          # Next.js Dashboard
│   ├── app/
│   │   ├── api/
│   │   │   ├── incidents/        # Incident API routes
│   │   │   └── agent-status/     # Agent status endpoints
│   │   ├── page.tsx              # Main dashboard page
│   │   └── layout.tsx            # App layout
│   ├── package.json
│   └── tsconfig.json
├── services/                     # Microservices
│   ├── sms-service/              # SMS microservice (port 3001)
│   │   ├── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── sms-service.test.ts   # Regression tests
│   └── payment-service/          # Payment microservice (port 3002)
│       ├── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── payment-service.test.ts # Regression tests
├── scripts/                      # Automation scripts
│   ├── chaos-monkey.ts           # Failure injection
│   └── sentinel-agent.ts         # Auto-resolution engine
├── docs/                         # Documentation
│   ├── incident-history.log      # Incident tracking log
│   └── sentinel.db               # SQLite database
├── scripts/
├── package.json                  # Root package.json
├── tsconfig.json                 # Root TypeScript config
├── jest.config.js                # Jest test configuration
├── CLAUDE.md                     # Claude Code instructions
└── README.md                     # This file
```

---

## Architecture Deep Dive

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    PROJECT SENTINEL                     │
                    └─────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────────────────────────────────┐
  │              │         │          SERVICES LAYER                     │
  │   CHAOS      │         │  ┌─────────────────┐ ┌─────────────────┐  │
  │   MONKEY     │────────▶│  │  SMS Service    │ │ Payment Service │  │
  │              │         │  │  Port: 3001      │ │ Port: 3002       │  │
  │  (Failure    │         │  │  /health        │ │ /health         │  │
  │   Injection) │         │  └────────┬────────┘ └────────┬────────┘  │
  └──────────────┘         └───────────┼──────────────────┼───────────┘
                                        │                  │
                                        ▼                  ▼
                              ┌─────────────────────────────────┐
                              │           SQLite DB              │
                              │   /docs/sentinel.db              │
                              │                                  │
                              │   ┌─────────────────────────┐   │
                              │   │  services table         │   │
                              │   │  - id (TEXT PRIMARY KEY)│   │
                              │   │  - name                 │   │
                              │   │  - status               │   │
                              │   │  - last_checked         │   │
                              │   │  - incident_count      │   │
                              │   └─────────────────────────┘   │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────┐
                              │        SENTINEL AGENT           │
                              │   (Autonomous Resolution)        │
                              │                                  │
                              │   • Polls health endpoints       │
                              │   • Detects failures             │
                              │   • Analyzes incident history    │
                              │   • Applies healing fixes        │
                              │   • Logs all actions            │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────┐
                              │       NEXT.JS DASHBOARD          │
                              │   http://localhost:3000          │
                              │                                  │
                              │   • Service status cards        │
                              │   • Incident timeline           │
                              │   • Resolution logs             │
                              │   • Auto-refresh every 5s       │
                              └─────────────────────────────────┘
```

---

## API Reference

### Health Endpoints

```bash
# SMS Service
curl http://localhost:3001/health
# Response: { "status": "healthy" }

# Payment Service
curl http://localhost:3002/health
# Response: { "status": "healthy" }
```

### Dashboard API

```bash
# Get all incidents
curl http://localhost:3000/api/incidents

# Get agent status
curl http://localhost:3000/api/agent-status
```

---

## AI-Driven Development

<div align="center">

### Built with Claude Code - Zero Manual Coding

</div>

Project Sentinel was **entirely built using Claude Code** (Anthropic's AI coding assistant). No code was written by hand.

#### How It Was Built

1. **Initial Setup**: Gave Claude Code the project requirements and watched it scaffold the entire project structure
2. **Architecture Design**: Claude Code designed the microservices architecture with SQLite persistence
3. **Implementation**: Every file - services, dashboard, chaos monkey, agent - was generated by AI
4. **Testing**: Regression tests were written by the AI to ensure reliability
5. **Iteration**: Asked for improvements, watched Claude Code refactor and enhance

#### The Build Process

```
User: "Build an autonomous incident resolution system"
    │
    ▼
Claude Code: "Let me create the full project structure..."
    │
    ├── app/ (Next.js dashboard)
    ├── services/ (microservices)
    ├── scripts/ (chaos monkey, agent)
    ├── docs/ (SQLite, logs)
    └── tests/ (regression suite)
    │
    ▼
User: "All tests passing. Commit it."
```

#### What Makes This Special

- **Zero Boilerplate**: No copy-paste from tutorials
- **Production-Ready**: Proper error handling, TypeScript types, tests
- **Self-Healing**: The agent can fix issues autonomously
- **Tested**: 8 regression tests ensure the system works correctly

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

MIT License - See LICENSE file for details.

---

<div align="center">

**Built with Claude Code** | **Zero Manual Code** | **100% Autonomous**

</div>