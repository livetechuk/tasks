# SEO Meeting Notes Integration - Implementation Guide

**Project**: tasks.livetech.co.uk Enhancement
**Status**: Ready for Development
**Last Updated**: 23 April 2026

---

## Overview

Three new tabs for tasks.livetech.co.uk:

1. **Marketing Review** (Sarah only) - Pull & review Search Console data
2. **Meeting Notes Report** (All marketing team) - Fill & export monthly meeting notes
3. **Admin Panel** (Holly only) - Manage users & SC data sync

---

## Phase 1: Database Setup (30 min)

Run schema.sql in Supabase SQL Editor.

Creates: sc_data, sc_selections, meeting_notes tables
Enables: Row Level Security (RLS) policies

Verification:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('sc_data', 'sc_selections', 'meeting_notes');
```

---

## Phase 2: Frontend Integration (2-3 hours)

### Step 1: Add Branding to <head>
```html
<link rel="stylesheet" href="https://use.typekit.net/lxu1rsq.css">
<link rel="icon" type="image/png" href="Livetech_Icon-33.png">
<style>
  :root {
    --color-navy: #14134f;
    --color-coral: #fd9357;
    --color-white: #ffffff;
    --color-mist: #f9fafb;
    --font-primary: 'nexa', sans-serif;
  }
</style>
```

### Step 2: Add Logo to Header
```html
<img src="Livetech_Logo-29.svg" alt="Livetech" height="30">
```

### Step 3: Include JavaScript Module
```html
<script src="seo-meeting-notes-module.js"></script>
<script>
  // After existing auth initialization:
  const seoModule = new SEOMeetingNotesModule(
    window.supabase,           // Your Supabase client
    currentUserEmail,          // From auth
    clientsList                // From Make datastore
  );
  const newTabs = await seoModule.init();
  // Add newTabs to your navigation
</script>
```

### Step 4: Test Each Tab
- Log in as Sarah -> Marketing Review should appear
- Log in as Charlie/Megan/Sabrina -> Meeting Notes Report should appear
- Log in as Holly -> Admin Panel should appear
- Log in as Paul -> None of these should appear

---

## Phase 3: BigQuery Integration (1-2 days)

BigQuery -> Supabase Sync triggered by Sarah clicking "Refresh SC Data":

1. Claude API receives: { clientId, month, dateRange }
2. Claude calls BigQuery (project: livetech-website, region: europe-west2):
   ```sql
   SELECT url, SUM(clicks) as clicks, SUM(impressions) as impressions,
          ROUND(AVG(sum_position), 1) as avg_position
   FROM `livetech-website.searchconsole_[DATASET]`.searchdata_url_impression
   WHERE data_date >= [dateFrom] AND data_date <= [dateTo]
   GROUP BY url ORDER BY impressions DESC LIMIT 50
   ```
3. Results inserted into Supabase sc_data table
4. Frontend updates dashboard in real-time

CRITICAL: BigQuery region must be europe-west2 (London). US region causes errors.

### BigQuery Dataset Name Mapping
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
Conwy Digital    -> searchconsole_conwydigital (matches!)
```

---

## Phase 4: Testing & Deployment (1 day)

1. Test with Novachrome (Sarah's primary client)
2. Verify RLS policies allow/deny correctly
3. Test file uploads for screenshots/WordPress health
4. Test PDF export
5. Train team on new workflow
6. Deploy to production

---

## Key Decisions

### Month Management
- Month format: "MM-YYYY" stored in Supabase
- Display: "April 2026" (in UI)
- Auto-creates next month on 1st of month
- Dropdown shows current + next 6 months

### Data Flow
Sarah clicks "Refresh" -> Claude API
  -> BigQuery (livetech-website project)
  -> Supabase (sc_data table)
  -> Frontend updates dashboard

Sarah selects URLs (checkboxes)
  -> Supabase (sc_selections table)

Team sees auto-populated SC tasks
  -> Meeting Notes form

### Permissions
- Sarah: Full access (marketing head)
- Charlie, Megan, Sabrina: Can view & edit own notes
- Holly: Admin panel only
- Paul: No access

---

## Supabase Helper Functions

```javascript
// Fetch SC data for dashboard
async function loadScDataForClient(clientId, month) {
  const { data } = await supabase
    .from('sc_data')
    .select('*')
    .eq('client_id', clientId)
    .eq('month', month)
    .order('clicks', { ascending: false });
  return data;
}

// Save checkbox selections
async function saveScSelections(month, clientId, selectedUrls) {
  const { data } = await supabase
    .from('sc_selections')
    .upsert({ month, client_id: clientId, selected_urls: selectedUrls, selected_by: currentUserEmail });
  return data;
}

// Get current month string ("04-2026")
function getCurrentMonthString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${month}-${now.getFullYear()}`;
}
```

---

## Testing Checklist

- Supabase tables created
- Each tab loads for correct users only
- Month dropdown shows current + 6 months
- SC data loads after "Refresh" button
- Checkbox selections persist after page reload
- Meeting notes form auto-populates from selections
- Saving notes works (Supabase updated)
- Team can see each other's notes (view only)
- PDF export generates valid PDF
- File uploads work (screenshots, WordPress health)
- Mobile responsive
- No JS errors in console

---

## Troubleshooting

**Issue**: "Permission denied" on Supabase
- Fix: Check RLS policies. User email must match auth.email()

**Issue**: SC data shows "No data found" after refresh
- Fix: Check BigQuery dataset name mapping (see table above)

**Issue**: Meeting notes doesn't auto-populate SC tasks
- Fix: Verify Sarah saved selections in sc_selections table

**Issue**: File uploads fail
- Fix: Check Supabase Storage bucket permissions

**Issue**: Month dropdown empty
- Fix: Check system date, verify getMonthOptions() logic

---

## Future Enhancements

- SE Ranking API integration (auto-screenshots)
- Focus Keywords API integration
- Email notifications when notes due
- Monthly digest report for Holly
- Client-facing portal view
- Abbey/Coastline shared note handling
- SC data reconciliation tool

---

## Integration Points

- Supabase: mwrhsviivkcwwhmqlmev.supabase.co
- BigQuery: livetech-website (ID: 224575103447, region: europe-west2)
- Google Workspace auth: via MSAL (existing)
- GitHub: livetechuk/tasks (commit: 9c27c3d)
