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
npm run start:app    # Start Next.js dashboard (port 3000)
npm run start:services # Start microservices

# Demo Flow (human-triggered)
npm run chaos        # Unleash chaos - breaks a random service (shows RED)
npm run fix          # Fix broken services - applies fix, runs tests (shows GREEN)

# Tests
npm test             # Run all tests
npm test -- --watch # Watch mode
npx vitest run <file> # Single test file
```

## Resolution Protocol

**When a CRITICAL incident occurs:**

1. **Main Agent**: Update dashboard incident status to "Investigating"
2. **Subagent Alpha (Debugger)**: Read `/services/logs`, find the bug, fix it
3. **Subagent Beta (QA)**: Write a regression test for the bug that was fixed
4. **Main Agent**: Update dashboard to "Resolved" after subagents complete

**Before applying ANY fix to an incident:**

1. Read `/docs/incident-history.log`
2. Check if this type of fix has failed before
3. If failed before: think harder to find an alternative approach
4. Document all attempted fixes (success or failure) in the log

## Code Standards

- **Language**: Always use TypeScript
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Testing**: Write tests BEFORE committing (follows TDD)

## Database Access

This project uses SQLite MCP Server. Claude must use the MCP sqlite tools to query the sentinel.db database directly instead of reading files.

## Architecture

- **Frontend**: Next.js dashboard displaying service health, incident status, and resolution logs
- **Services**: Microservices handling specific incident types (e.g., database, API, worker)
- **Chaos Monkey**: Randomly injects failures to test autonomous resolution
- **Resolution Engine**: Analyzes incidents, looks up past failures, applies fixes