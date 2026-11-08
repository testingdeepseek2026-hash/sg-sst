# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Complete development best practices stack implementation
- ESLint 9 Flat Config with TypeScript/React strict rules
- Prettier 3 with organized imports plugin
- Husky 9 + lint-staged + commitlint for Conventional Commits
- GitHub Actions CI/CD pipeline (lint, test matrix Node 20/22, build, e2e, docker, release)
- Dependabot configuration for npm and GitHub Actions
- CODEOWNERS for mandatory reviews
- PR template and Issue templates (bug, feature)
- Comprehensive documentation in `/docs` (Architecture, API, Database, Development, Deployment, Contributing)
- Server: Vitest config with coverage thresholds (80% services)
- Server: Unit tests for policies, hazards, workers_exams, workers_certs, workers_epp, alerts, standards
- Server: Integration tests for policies, hazards, workers_items routes + migrations
- Web: Vitest + Testing Library + jsdom config
- Web: Component tests for Login, Estandares, Hazards, Trabajadores, Politica, Dashboard
- Web: Hook tests for useAuth, API client tests
- Web: Playwright config + E2E tests (login, dashboard navigation, CRUD basics)
- EditorConfig, .nvmrc (Node 22), updated .gitignore

### Changed

- Root package.json: Added all devDependencies and comprehensive scripts
- Server package.json: Added test:watch, test:coverage, typecheck scripts
- Web package.json: Added test, test:watch, test:coverage, test:e2e, typecheck, lint scripts

## [1.0.0] - 2026-01-15

### Added

- Initial SG-SST implementation for microempresa instalaciones electrónicas
- Backend: Fastify 5 + TypeScript + SQLite (node:sqlite)
- Frontend: React 18 + TypeScript + Vite 6 + PWA
- Authentication: JWT in httpOnly cookies
- Modules: Companies, Users, Roles SST, Workers, Exams, Certs, EPP
- IPERC: Hazard catalog + risk assessments
- Standards: ISO 45001 + Resoluciones Colombia + assessments
- Policies: Versioning, signing, disclosure, objectives
- Annual plan, Indicators (KPI), Incidents, Inspections
- Documents, Actions, Audits, Alerts (auto-generated)
- Export/Import (Excel), Email alerts (nodemailer)
- Seed data: hazard catalog, standards, demo company, admin user
- Migrations: 001_initial.sql with all 24 tables

---

## Release Notes Format

### Added

- New features

### Changed

- Changes in existing functionality

### Deprecated

- Soon-to-be removed features

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Vulnerability fixes
