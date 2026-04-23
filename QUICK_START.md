# SEO Meeting Notes Integration - Quick Start Guide

## Project Status: COMPLETE & READY

**Commit**: `9c27c3d` (local git repo)
**Supabase DB**: mwrhsviivkcwwhmqlmev.supabase.co
**BigQuery Project**: livetech-website (ID: 224575103447)

---

## What You're Getting

Three new tabs for tasks.livetech.co.uk:

**1. Marketing Review** (Sarah only)
- Pulls Search Console data from BigQuery
- Shows top URLs with clicks/impressions
- Checkbox interface to select URLs
- Auto-saves selections to Supabase

**2. Meeting Notes Report** (All marketing team)
- Monthly form per client
- Auto-populated "SC Tasks" section (from Sarah's selections)
- Manual fields for team input
- Real-time Supabase sync + PDF export

**3. Admin Panel** (Holly only)
- Team view by department (Dev Team | Marketing Team)
- SC data sync history + status
- Manual sync trigger

---

## Deployment Steps (4 Phases)

### Phase 1: Database Setup (30 minutes)

1. Log in to Supabase (mwrhsviivkcwwhmqlmev.supabase.co)
2. Go to SQL Editor, New query
3. Copy/paste schema.sql and click Run
4. Verify: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('sc_data', 'sc_selections', 'meeting_notes');` - should return 3 rows

### Phase 2: Frontend Integration (2-3 hours)

Add to `<head>` of index.html:
```html
<link rel="stylesheet" href="https://use.typekit.net/lxu1rsq.css">
<link rel="icon" type="image/png" href="Livetech_Icon-33.png">
<style>:root { --color-navy: #14134f; --color-coral: #fd9357; --font-primary: 'nexa', sans-serif; }</style>
```

Add logo to header area:
```html
<img src="Livetech_Logo-29.svg" alt="Livetech" height="30" style="margin-right: 20px;">
```

Add before closing `</body>`:
```html
<script src="seo-meeting-notes-module.js"></script>
<script>
  const seoModule = new SEOMeetingNotesModule(window.supabase, currentUserEmail, clientsList);
  const newTabs = await seoModule.init();
  // Add newTabs to your navigation
</script>
```

Test: Log in as each team member and verify correct tabs appear.

### Phase 3: BigQuery Integration (1-2 days)

When Sarah clicks "Refresh SC Data":
- Calls Claude API
- Claude queries BigQuery (livetech-website project, europe-west2 region)
- Data inserted into Supabase sc_data table
- Dashboard updates

BigQuery dataset name mapping:
```
Novachrome       -> searchconsole_novachrome
Dewi Jones       -> searchconsole_dewiglyn
Good Wine Online -> searchconsole_gwo
Greenhouse       -> searchconsole_ghs
Karmic Synergy   -> searchconsole_karmic
Mermaid Seafoods -> searchconsole_mermaidfish
The Oasis        -> searchconsole_oasishotel
Party Wall Surv. -> searchconsole_stormpw
Sproule ERCE     -> searchconsole_sprouleerce
Vale Guided Tours-> searchconsole_valeguided
Penrhos Heights  -> searchconsole_wpvhomes
Ski 4 Less       -> searchconsole_ski4lessgroups
Conwy Digital    -> searchconsole_conwydigital
```

### Phase 4: Testing & Go-Live (1-2 days)

Test checklist:
- Supabase tables created
- Each tab loads for correct users only
- Month dropdown works (current + 6 months)
- SC data loads after refresh
- Checkbox selections save/persist
- Team members see auto-populated notes
- Notes save to Supabase
- PDF export button works
- Mobile responsive
- No JS errors in browser console

---

## Team Permissions

| User    | Marketing Review | Meeting Notes | Admin Panel |
|---------|-----------------|--------------|-------------|
| Sarah   | Full access     | Edit own     | No          |
| Charlie | No              | Edit own     | No          |
| Megan   | No              | Edit own     | No          |
| Sabrina | No              | Edit own     | No          |
| Holly   | No              | View only    | Full access |
| Paul    | No              | No           | No          |

---

## Quick Troubleshooting

| Problem | Solution |
|---------|---------|
| Tables missing | Run schema.sql again, check SQL errors |
| "Permission denied" | Check user email matches auth.email() |
| SC data empty | Check BigQuery dataset name mapping above |
| Module not loading | Verify seo-meeting-notes-module.js path |
| Month dropdown empty | Check getMonthOptions() function |

---

## Files in This Folder

- `schema.sql` - Run in Supabase SQL Editor
- `seo-meeting-notes-module.js` - Add to tasks.livetech.co.uk
- `Livetech_Logo-29.svg` - Logo for header
- `Livetech_Icon-33.png` - Favicon
- `QUICK_START.md` - This file
- `IMPLEMENTATION_GUIDE.md` - Detailed reference
- `PROJECT_SUMMARY.md` - Executive overview

**Project Created**: 23 April 2026 | Status: READY FOR DEPLOYMENT
