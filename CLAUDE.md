# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Sentinel is an autonomous incident resolution system. It monitors services, detects failures via Chaos Monkey, and auto-resolves incidents.

## Directory Structure

```
/app          - Next.js frontend dashboard (port 3000)
/services     - Node.js microservices simulating backend work
/scripts      - Chaos Monkey script that randomly breaks services
/docs         - Incident history and documentation
```

## Commands

```bash
# Development
npm run dev          # Start all services + frontend
docker compose up   # Start infrastructure (Kafka, etc.)

# Frontend only
cd app && npm run dev

# Services
cd services && npm run start

# Chaos Monkey
node scripts/chaos-monkey.js

# Tests
npm test             # Run all tests
npm test -- --watch # Watch mode
npx vitest run <file> # Single test file
```

## Resolution Protocol

**Before applying ANY fix to an incident:**

1. Read `/docs/incident-history.log`
2. Check if this type of fix has failed before
3. If failed before: think harder to find an alternative approach
4. Document all attempted fixes (success or failure) in the log

## Code Standards

- **Language**: Always use TypeScript
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Testing**: Write tests BEFORE committing (follows TDD)
- **Infrastructure**: SQLite for persistence, Kafka (simulated) for messaging

## Architecture

- **Frontend**: Next.js dashboard displaying service health, incident status, and resolution logs
- **Services**: Microservices handling specific incident types (e.g., database, API, worker)
- **Chaos Monkey**: Randomly injects failures to test autonomous resolution
- **Resolution Engine**: Analyzes incidents, looks up past failures, applies fixes