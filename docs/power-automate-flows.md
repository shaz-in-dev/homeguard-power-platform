# HomeGuard — Power Automate Flows

Three cloud flows automate the Awaab's Law notifications so nothing relies on someone remembering to check a case:

1. **Report acknowledgement** — emails the resident the moment they report a hazard.
2. **SLA deadline monitor** — a daily sweep that escalates cases approaching or breaching a statutory deadline, and keeps the RAG status accurate.
3. **Resolution notification** — emails the resident when their case is resolved.

Build these in **make.powerautomate.com** (the HomeGuard Dev environment).

## Connections (approve once each)
- **Microsoft Dataverse**
- **Office 365 Outlook** (the sending mailbox)

> These are OAuth sign-ins — you approve them once and every flow reuses them.

---

## Flow 1 — Report acknowledgement

**Purpose:** confirm receipt to the resident and set expectations against Awaab's Law timescales.

**Trigger** — Dataverse **When a row is added, modified or deleted**
| Setting | Value |
|---|---|
| Change type | Added |
| Table name | Hazard Cases |
| Scope | Organization |

**Step 2 — Condition** (only continue if a resident is linked)
`@{triggerOutputs()?['body/_hg_residentid_value']}` **is not equal to** *(blank)*

**Step 3 (If yes) — Get a row by ID** (Dataverse)
- Table: **Residents**
- Row ID: `@{triggerOutputs()?['body/_hg_residentid_value']}`

**Step 4 — Send an email (V2)** (Office 365 Outlook)
- **To:** `@{outputs('Get_a_row_by_ID')?['body/hg_email']}`
- **Subject:** `We've received your report — @{triggerOutputs()?['body/hg_name']}`
- **Body** (open **</> Code view** and paste):

```html
<div style="font-family:Segoe UI,Arial,sans-serif;color:#14262e;max-width:560px">
  <div style="background:#0f5e7a;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
    <h2 style="margin:0">HomeGuard</h2>
  </div>
  <div style="border:1px solid #dce6e9;border-top:0;padding:24px;border-radius:0 0 10px 10px">
    <p>Hi @{outputs('Get_a_row_by_ID')?['body/hg_name']},</p>
    <p>Thank you for reporting a damp or mould problem in your home. It has been logged and a housing officer will review it shortly.</p>
    <p style="font-size:18px"><strong>Your reference:</strong> @{triggerOutputs()?['body/hg_name']}</p>
    <p style="background:#f4f8f9;border-left:4px solid #0f5e7a;padding:12px 16px">
      Under <strong>Awaab's Law</strong> we investigate hazards within <strong>14 days</strong>
      &mdash; within <strong>24 hours</strong> if it is an emergency &mdash; and begin repairs within <strong>7 days</strong>.
    </p>
    <p>We will keep you updated. If your situation gets worse, please contact us straight away.</p>
    <p style="color:#5c6f77;font-size:13px;margin-top:24px">Together Housing &middot; HomeGuard</p>
  </div>
</div>
```

---

## Flow 2 — SLA deadline monitor (the "it's getting late" flow)

**Purpose:** because deadlines pass with the clock (no record change fires an event), a **scheduled** sweep is the correct pattern. Each run escalates overdue/at-risk cases *and* writes the RAG status back so the apps stay accurate.

**Trigger** — **Recurrence**
| Setting | Value |
|---|---|
| Interval | 1 |
| Frequency | Day |
| At these hours | 8 |

**Step 2 — List rows** (Dataverse)
- Table: **Hazard Cases**
- **Filter rows:** `statecode eq 0 and hg_status ne 7 and hg_status ne 8`
  *(active cases that are not Resolved (7) or Closed (8))*

**Step 3 — Apply to each** → output `value` of List rows.

Inside the loop:

### Condition A — Breached? (repair deadline passed)
`@{items('Apply_to_each')?['hg_repairdeadline']}` **is less than** `@{utcNow()}`

**If yes:**
- **Update a row** (Dataverse) → Hazard Cases, Row ID `@{items('Apply_to_each')?['hg_hazardcaseid']}` → **SLA Status = Breached**
- **Send an email (V2)** → To: `@{items('Apply_to_each')?['_owninguser_value@OData.Community.Display.V1.FormattedValue']}` *(the case owner — or a fixed compliance inbox)*
  - **Subject:** `🔴 SLA BREACHED — @{items('Apply_to_each')?['hg_name']}`
  - **Body:**
```html
<div style="font-family:Segoe UI,Arial,sans-serif;color:#14262e;max-width:600px">
  <div style="background:#c23a28;color:#fff;padding:16px 22px;border-radius:8px 8px 0 0">
    <h3 style="margin:0">SLA breached — action required</h3>
  </div>
  <div style="border:1px solid #eecfca;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <p><strong>@{items('Apply_to_each')?['hg_name']}</strong> has passed its repair deadline.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="color:#5c6f77;padding:3px 16px 3px 0">Severity</td><td>@{items('Apply_to_each')?['hg_severity@OData.Community.Display.V1.FormattedValue']}</td></tr>
      <tr><td style="color:#5c6f77;padding:3px 16px 3px 0">Status</td><td>@{items('Apply_to_each')?['hg_status@OData.Community.Display.V1.FormattedValue']}</td></tr>
      <tr><td style="color:#5c6f77;padding:3px 16px 3px 0">Repair deadline</td><td>@{formatDateTime(items('Apply_to_each')?['hg_repairdeadline'],'dd MMM yyyy')}</td></tr>
    </table>
    <p style="color:#c23a28"><strong>This case is now outside its statutory timescale. Please action immediately.</strong></p>
  </div>
</div>
```

### Condition B — At risk? (investigation deadline within 2 days) — put in Condition A's **If no** branch
`@{items('Apply_to_each')?['hg_investigationdeadline']}` **is less than** `@{addDays(utcNow(),2)}`

**If yes:**
- **Update a row** → **SLA Status = At Risk**
- **Send an email (V2)** → To: case owner
  - **Subject:** `🟠 SLA at risk — @{items('Apply_to_each')?['hg_name']}`
  - **Body:** same layout, amber header (`#b9791b`), text: *"The investigation deadline (@{formatDateTime(items('Apply_to_each')?['hg_investigationdeadline'],'dd MMM yyyy')}) is approaching."*

---

## Flow 3 — Resolution notification

**Purpose:** close the loop — tell the resident when their case is resolved.

**Trigger** — Dataverse **When a row is added, modified or deleted**
| Setting | Value |
|---|---|
| Change type | Modified |
| Table name | Hazard Cases |
| Scope | Organization |
| Select columns | hg_status |

**Trigger condition** (Settings → Trigger conditions) so it only fires when the status becomes *Resolved (7)*:
```
@equals(triggerOutputs()?['body/hg_status'], 7)
```

**Step 2 — Get a row by ID** (Residents) → Row ID `@{triggerOutputs()?['body/_hg_residentid_value']}`

**Step 3 — Send an email (V2)**
- **To:** `@{outputs('Get_a_row_by_ID')?['body/hg_email']}`
- **Subject:** `Your report has been resolved — @{triggerOutputs()?['body/hg_name']}`
- **Body:**
```html
<div style="font-family:Segoe UI,Arial,sans-serif;color:#14262e;max-width:560px">
  <div style="background:#107c56;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
    <h2 style="margin:0">HomeGuard</h2>
  </div>
  <div style="border:1px solid #dce6e9;border-top:0;padding:24px;border-radius:0 0 10px 10px">
    <p>Hi @{outputs('Get_a_row_by_ID')?['body/hg_name']},</p>
    <p>Good news — your damp &amp; mould report <strong>@{triggerOutputs()?['body/hg_name']}</strong> has been resolved.</p>
    <p>If the problem returns, or you're not happy with the work, please report it again and we'll act on it.</p>
    <p style="color:#5c6f77;font-size:13px;margin-top:24px">Together Housing &middot; HomeGuard</p>
  </div>
</div>
```

---

## Notes & enhancements
- **Portal-submitted cases** aren't linked to a Resident record, so Flow 1/3 skip them. To cover those too, add a **`Reporter Email`** column to Hazard Case (the portal already collects it) and email that when the resident lookup is empty.
- **Escalation:** for repeated breaches, add a step to also email a compliance manager / create a Teams post.
- **Vulnerable households:** add a branch that flags cases where the linked Resident's *Vulnerable Resident* = Yes for priority handling.
