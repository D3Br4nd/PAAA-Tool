# QuestHub — Open Source Publication Plan

> **Status**: 📋 Planning Phase  
> **Target License**: MIT  
> **Target Audience**: Self-hosted open source community  
> **Last Updated**: 2026-01-28

---

## 📌 Project Decisions Summary

| Decision | Choice |
|----------|--------|
| **New Project Name** | **QuestHub** |
| **Homepage Strategy** | Remove current page, create generic template/placeholder |
| **Static Assets (logos/favicons)** | User will provide custom assets later |
| **Organization References** | Remove all Pro Loco/Venticano/PAAA references |
| **Contributing Guidelines** | Yes, create CONTRIBUTING.md |
| **Code of Conduct** | Yes, create CODE_OF_CONDUCT.md |

---

## 🎯 Goals

1. **Rebrand** the project from "PAAA-Tool" to **"QuestHub"**
2. **Internationalize** the UI with support for **English (default)** and **Italian**
3. **Remove** all hardcoded organization-specific content
4. **Prepare** standard open source documentation
5. **Create** a generic, configurable landing page

---

## 📦 Package Identity Changes

### package.json Updates

```json
{
  "name": "questhub",
  "version": "1.0.0",
  "description": "Self-hosted treasure hunt & event management platform",
  "private": false,
  "license": "MIT",
  "keywords": [
    "treasure-hunt",
    "event-management",
    "gamification",
    "self-hosted",
    "svelte",
    "sveltekit"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/questhub.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/questhub/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/questhub#readme",
  "author": "Max Brandini <email@example.com>"
}
```

---

## 🌍 Internationalization (i18n) System

### Architecture

```
src/lib/
├── i18n.ts                    # Main i18n module
├── translations/
│   ├── en.json                # English translations (default)
│   └── it.json                # Italian translations
```

### Environment Variable

```env
# Language configuration
APP_LANG=en    # Options: en | it
```

### Usage Example

```svelte
<script>
  import { t } from '$lib/i18n';
</script>

<h1>{t('dashboard.welcome')}</h1>
<button>{t('common.save')}</button>
```

### Translation File Structure

```json
// en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "login": {
    "title": "Login",
    "teamCode": "Team Code",
    "email": "Email",
    "password": "Password",
    "submit": "Sign In"
  },
  "dashboard": {
    "welcome": "Welcome to QuestHub",
    "overview": "System overview",
    "users": "Users",
    "teams": "Teams",
    "events": "Events"
  }
  // ... etc
}
```

---

## 🏠 Homepage Strategy

### Current State
The current homepage (`src/routes/+page.svelte`, 659 lines) contains:
- Pro Loco Venticanese branding and logos
- Specific event descriptions (CaTE, Mystery Party)
- Venticano location references
- Italian-only content
- Links to prolocoventicano.com

### Target State
Create a **generic template landing page** with:
- QuestHub branding
- Brief feature overview (from README)
- Login/Get Started CTA
- Configurable via environment variables (optional future enhancement)

### Placeholder Content Ideas
- Project tagline: "Self-hosted Event & Treasure Hunt Platform"
- Feature highlights: Teams, Scoring, Phases, Staff PWA
- Quick start guide link
- GitHub repository link

---

## 🗑️ Content to Remove

### Hardcoded References to Remove

| File | Content | Action |
|------|---------|--------|
| `src/routes/+page.svelte` | All Pro Loco/PAAA/Venticano references | Replace with generic content |
| `src/routes/login/+page.svelte` | "PAAA-Tool", Pro Loco logos | Replace with QuestHub branding |
| `src/routes/[slug]/+page.svelte` | Pro Loco/Venticano text | Make configurable or remove |
| `src/routes/dashboard/+layout.svelte` | "PAAA Tool" text | Replace with "QuestHub" |
| `src/routes/dashboard/+page.svelte` | "PAAA-Tool" references | Replace with "QuestHub" |
| `src/routes/dashboard/settings/+page.svelte` | "PAAA-Tool v2.0.0" | Replace with "QuestHub" |
| `src/routes/dashboard/events/+page.svelte` | "CaTE - Caccia al Tesoro Evolution" | Make generic |
| `src/app.html` | "PAAA" in meta tags | Replace with "QuestHub" |
| `src/lib/server/db.ts` | "PAAA-Tool" in comments | Update comments |
| `src/lib/server/schema.ts` | "PAAA-Tool" in comments | Update comments |
| `src/lib/scoring.ts` | "PAAA-Tool" in comments | Update comments |
| `README.md` | All Italian content | Rewrite in English |
| `STACK.md` | All Italian content | Rewrite in English |

### Static Assets to Replace (User Provided Later)

| Current File | Description |
|--------------|-------------|
| `/static/mini-icon-plv-white.png` | Pro Loco logo |
| `/static/paaa-logo.png` | PAAA committee logo |
| `/static/plv-logo.png` | Pro Loco logo |
| `/static/favicon.ico` | Favicon |
| `/static/favicon.svg` | Favicon SVG |
| `/static/favicon-96x96.png` | Favicon PNG |
| `/static/apple-touch-icon.png` | iOS icon |
| `/static/web-app-manifest-192x192.png` | PWA icon |
| `/static/web-app-manifest-512x512.png` | PWA icon |
| `/static/site.webmanifest` | PWA manifest (update name) |

### External Links to Remove

- `https://www.prolocoventicano.com/paaa/#cate`
- `https://www.prolocoventicano.com/paaa/#cena`
- `https://www.prolocoventicano.com/privacy-policy/`
- `https://www.prolocoventicano.com/cookie-policy/`
- `https://www.prolocoventicano.com/`

---

## 📄 New Documentation Files

### 1. README.md (Complete Rewrite)

```markdown
# QuestHub

Self-hosted treasure hunt & event management platform.

## Features
- Team-based gameplay with scoring system
- Multi-phase event structure (Macro Phases → Phases → Challenges)
- Staff PWA for on-field scoring
- Real-time leaderboards
- Offline-first architecture
- Multi-language support (EN/IT)

## Quick Start
...

## Configuration
...

## Docker Deployment
...
```

### 2. CONTRIBUTING.md

```markdown
# Contributing to QuestHub

## Development Setup
1. Clone the repository
2. Install dependencies: `npm install` (or `bun install`)
3. Copy environment: `cp .env.example .env`
4. Start dev server: `npm run dev`

## Code Style
- Run `npm run lint` before committing
- Run `npm run format` to auto-format code

## Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Reporting Issues
...
```

### 3. CODE_OF_CONDUCT.md

Use the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) standard.

---

## 🔧 Environment Variables Update

### New .env.example

```env
# ===========================================
# QuestHub Configuration
# ===========================================

# Application
HOST=0.0.0.0
PORT=3000

# Public URLs
PUBLIC_APP_URL=https://your-domain.com
ORIGIN=https://your-domain.com

# Database (LibSQL/sqld)
DATABASE_URL=http://db:8080
DATABASE_AUTH_TOKEN=
LIBSQL_ADMIN_AUTH_KEY=
DATABASE_ADMIN_URL=http://db:9090

# Admin Seeding
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme

# ===========================================
# Internationalization
# ===========================================
APP_LANG=en    # en | it

# ===========================================
# Optional: Custom Branding (future)
# ===========================================
# PUBLIC_APP_NAME=QuestHub
# PUBLIC_ORG_NAME=My Organization
```

---

## 📁 Files to Create

| File | Purpose |
|------|---------|
| `src/lib/i18n.ts` | i18n utility functions |
| `src/lib/translations/en.json` | English translations |
| `src/lib/translations/it.json` | Italian translations |
| `CONTRIBUTING.md` | Contribution guidelines |
| `CODE_OF_CONDUCT.md` | Community standards |

---

## 📁 Files to Modify

| File | Changes |
|------|---------|
| `package.json` | New name, metadata, public |
| `.env.example` | Add `APP_LANG` and documentation |
| `src/app.d.ts` | Add env type definitions |
| `src/app.html` | Update meta tags |
| `README.md` | Complete English rewrite |
| `STACK.md` | Translate to English |
| `LICENSE` | Update copyright |
| `static/site.webmanifest` | Update app name |
| All `.svelte` files with UI text | Use i18n translations |
| All files with PAAA/Pro Loco comments | Update comments |

---

## 📁 Files to Delete/Replace

| File | Action |
|------|---------|
| `/static/mini-icon-plv-white.png` | Replace with user-provided asset |
| `/static/paaa-logo.png` | Replace with user-provided asset |
| `/static/plv-logo.png` | Replace with user-provided asset |
| Other branded assets | Replace with user-provided assets |

---

## ✅ Implementation Checklist

### Phase 1: Core i18n System
- [ ] Create `src/lib/i18n.ts` module
- [ ] Create `src/lib/translations/en.json`
- [ ] Create `src/lib/translations/it.json`
- [ ] Add `APP_LANG` to `.env.example`
- [ ] Add types to `app.d.ts`

### Phase 2: Package & Identity
- [ ] Update `package.json` with new name and metadata
- [ ] Update `LICENSE` copyright
- [ ] Update `static/site.webmanifest`
- [ ] Update `src/app.html` meta tags

### Phase 3: Documentation
- [ ] Rewrite `README.md` in English
- [ ] Translate `STACK.md` to English
- [ ] Create `CONTRIBUTING.md`
- [ ] Create `CODE_OF_CONDUCT.md`

### Phase 4: Homepage Replacement
- [ ] Create generic placeholder homepage
- [ ] Remove Pro Loco specific content
- [ ] Remove external links to prolocoventicano.com

### Phase 5: UI Translation Migration
- [ ] Migrate `src/routes/+page.svelte`
- [ ] Migrate `src/routes/login/+page.svelte`
- [ ] Migrate `src/routes/dashboard/+layout.svelte`
- [ ] Migrate `src/routes/dashboard/+page.svelte`
- [ ] Migrate `src/routes/dashboard/settings/+page.svelte`
- [ ] Migrate `src/routes/dashboard/events/+page.svelte`
- [ ] Migrate `src/routes/[slug]/+page.svelte`
- [ ] Migrate staff pages
- [ ] Migrate game pages
- [ ] Update code comments

### Phase 6: Static Assets
- [ ] Collect user-provided logos/icons
- [ ] Replace all branded assets
- [ ] Update favicon files
- [ ] Update PWA manifest icons

### Phase 7: Testing & Verification
- [ ] Run `npm run check`
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Test with `APP_LANG=en`
- [ ] Test with `APP_LANG=it`
- [ ] Docker deployment test

---

## 📊 Estimated Effort

| Phase | Hours |
|-------|-------|
| Core i18n System | 2-3 |
| Package & Identity | 1 |
| Documentation | 2 |
| Homepage Replacement | 2 |
| UI Translation Migration | 4-6 |
| Static Assets | 0.5 (user provides) |
| Testing & Verification | 1-2 |
| **Total** | **12-16 hours** |

---

## 🚀 Next Steps

1. **Confirm** this plan is accurate and complete
2. **Provide** custom logo/favicon assets when ready
3. **Start** implementation phase-by-phase
4. **Review** each phase before proceeding to next

---

> *"QuestHub — Making treasure hunts accessible to everyone"*
