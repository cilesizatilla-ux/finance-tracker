# Audit System — Feature Implementation Summary

**Date:** 2026-05-14  
**Status:** ✅ Complete and live  
**Servers:** Backend http://localhost:8000 | Frontend http://localhost:5173

---

## Features Implemented

### 1. Duration Increments (0.5 days)
- Edit Audit modal: duration input with ±0.5 step buttons
- Snaps to 0.5 increments via `Math.round(v * 2) / 2`
- Helper text shows formatted duration (e.g., "1.5 days")
- **File:** `AdminAuditCalendar.jsx` (lines 314–572)

### 2. Factory Name Field
- Added `factory_name` column to `AuditEntry` model (nullable)
- Text input in Edit Audit form (placeholder: "e.g. Main Production Facility")
- Displayed in calendar event chips with opacity-70 subtitle
- **Files:** `models.py`, `audit.py` schemas, `AdminAuditCalendar.jsx`

### 3. Observer Role
- Added `"observer"` option to role dropdowns (Auditor, Lead, Reviewer, Observer)
- Violet badge color (#8b5cf6) for observer assignments
- **File:** `AdminAuditCalendar.jsx` (lines 48, 660, 778)

### 4. External Auditors (by Name + Email)
- New "External Auditor" section in Edit Audit form
- Name + Email + Role inputs with "Add" button
- Suggestion dropdown shows previously saved auditors from localStorage (`ft_audit_auditors`, max 10)
- Clicking suggestion auto-fills name + email
- Stores in `AuditAssignment` with nullable `user_id` + `auditor_name`/`auditor_email` fields
- **Backend:** `audit.py` updated `AssignPayload` to accept `auditor_name`/`auditor_email`
- **Files:** `models.py`, `AdminAuditCalendar.jsx` (lines 85–780)

### 5. Post-Scheduling Notify + Approval
- After creating/editing audit, "Notify Auditors" modal appears
- Step 1: Checkboxes for each assignment → sends `POST /admin/audit/entries/{id}/notify`
- Step 2: Approval request option → sends `POST /admin/audit/entries/{id}/request-approval`
- Sets `notify_sent` and `approval_requested` flags on assignments
- **File:** `AdminAuditCalendar.jsx` (lines 108–156, 827–832)

### 6. User Type Column (Admin Users page)
- New "Role" column between "Status" and "Actions"
- Colored badges: User (gray), Auditor (blue), Lead Auditor (amber), Observer (violet), Admin (red), Pending Admin (orange)
- Fetches from `profile.user_type`
- **File:** `AdminUsers.jsx` (lines 9–25, 223, 278)

### 7. Profile Setup Modal
- First-login role selection (User, Auditor, Lead Auditor, Observer, Admin)
- Modal with role cards + descriptions + icons
- If Admin selected → stores as `pending_admin` and shows approval message
- Dismissed after selection (tracked via localStorage)
- **File:** `ProfileSetupModal.jsx` (new, 173 lines)

### 8. Admin Approval Flow
- `POST /auth/profile-setup` endpoint: sets user_type on profile
- `POST /admin/users/{id}/approve-admin`: converts pending_admin → admin
- Super Admin only permission on approve endpoint
- **Files:** `auth.py`, `admin.py` (lines 389–404)

### 9. Audit Directory (Admin Audit Logs page)
- Two-tab layout: "Admin Logs" (existing) | "Audit Directory" (new)
- Directory shows 5 dark cards:
  - **Customers:** client_name → count of audits
  - **Factories:** factory_name or company_name → count
  - **Auditors:** name + email + audit_count (role = auditor/reviewer)
  - **Lead Auditors:** name + email + audit_count (role = lead)
  - **Observers:** name + email + audit_count (role = observer)
- Fetches from `GET /admin/audit/directory` endpoint
- **Files:** `AdminAuditLogs.jsx` (lines 20–155), `audit.py` (lines 394–419)

---

## Database Schema Changes

### AuditEntry
```python
factory_name: str (nullable)         # NEW
duration_days: float (not int)       # CHANGED from Integer
```

### AuditAssignment
```python
user_id: int (nullable, not required) # CHANGED from NOT NULL
auditor_name: str (nullable)         # NEW
auditor_email: str (nullable)        # NEW
notify_sent: bool (default False)    # NEW
approval_requested: bool (default False) # NEW
```

### UserProfile
```python
user_type: str (nullable)            # NEW
# Values: user, auditor, lead_auditor, observer, admin, pending_admin
```

### Migrations
Auto-run on startup via `backend/main.py` `on_startup()` handler.

---

## API Endpoints

### NEW Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/profile-setup` | Set user role after login |
| `POST` | `/admin/users/{id}/approve-admin` | Convert pending_admin → admin (super admin only) |
| `POST` | `/admin/audit/entries/{id}/notify` | Send notification to auditors |
| `POST` | `/admin/audit/entries/{id}/request-approval` | Request approval from auditors |
| `GET` | `/admin/audit/directory` | Fetch audit directory (customers/factories/auditors/leads/observers) |
| `DELETE` | `/admin/audit/entries/{id}/assignments/{assignment_id}` | Remove assignment by ID (for external auditors) |

### UPDATED Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /admin/audit/entries/{id}/assign` | Now accepts `auditor_name`/`auditor_email` without `user_id` |
| `GET /auth/profile` | Now includes `user_type` field in response |

---

## Frontend Files Modified

| File | Changes |
|------|---------|
| `AdminAuditCalendar.jsx` | Duration ±0.5, factory_name, observer role, external auditors, notify modal |
| `AdminUsers.jsx` | Role column with badges |
| `AdminAuditLogs.jsx` | Two-tab layout with Audit Directory cards |
| `ProfileSetupModal.jsx` | NEW — first-login role selection |
| `App.jsx` | ProfileSetupGate wrapper to show modal on first login |
| `api/index.js` | Added `setupProfile` function |

---

## Backend Files Modified

| File | Changes |
|------|---------|
| `models.py` | AuditEntry: +factory_name, duration_days→float; AuditAssignment: user_id nullable, +auditor_name/email/notify_sent/approval_requested; UserProfile: +user_type |
| `main.py` | DB migrations for all new columns on startup |
| `audit.py` | Schemas updated, _ser_entry enriched, assign endpoint supports external auditors, +notify/request-approval/directory endpoints |
| `auth.py` | GET /profile adds user_type, +POST /profile-setup endpoint |
| `admin.py` | User list includes user_type, +POST /approve-admin endpoint |

---

## Testing Checklist

- [ ] Profile Setup Modal appears on first login
- [ ] Role selection works (User, Auditor, Lead, Observer, Admin)
- [ ] Admin selection shows pending approval message
- [ ] Edit Audit: duration ±0.5 step works
- [ ] Edit Audit: factory_name field present and saves
- [ ] Edit Audit: observer role in dropdowns
- [ ] External Auditor: name+email input, localStorage memory works
- [ ] After save: Notify modal appears with checkboxes + approval step
- [ ] Admin Users: Role column shows colored badges
- [ ] Admin Audit Logs: Two tabs visible (Admin Logs, Audit Directory)
- [ ] Audit Directory: All 5 cards populate correctly (Customers, Factories, Auditors, Leads, Observers)

---

## Known Limitations

- External auditors (no user_id) can't be unassigned from UI (button only shows for registered users)
- Notify/approval endpoints currently mark flags but don't send real emails (in production, integrate email service)
- Audit Directory doesn't filter by date/month (shows all-time aggregates)

