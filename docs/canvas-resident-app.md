# "Report a Hazard" — Resident Canvas App (build guide)

A lightweight, mobile-first canvas app that lets a **resident** report damp/mould, which creates a `hg_hazardcase` record (Status = *New*, SLA = *On Track*) that then flows into the HomeGuard model-driven app for officers.

> Environment: **Muhammed…'s Environment** (`org0155b163`). Build at make.powerapps.com.

---

## 1. Create the app
1. make.powerapps.com → **+ Create** → **Blank app** → **Blank canvas app**.
2. Name: **Report a Hazard** · Format: **Phone** · Create.

## 2. Add data
Left rail → **Data** → **+ Add data** → search and add:
- **Hazard Cases** (`hg_hazardcase`)
- **Properties** (`hg_property`)
- **Residents** (`hg_resident`)

## 3. Screen 1 — Welcome (`scrWelcome`)
- **Rename** Screen1 → `scrWelcome`.
- Add a **Label** (title): `"Report Damp or Mould"`; a subtitle label: `"Tell us about a problem in your home and we'll act on it under Awaab's Law."`
- Add a **Button**: Text `"Start a report"`, `OnSelect`:
  ```powerfx
  NewForm(frmReport); Navigate(scrReport, ScreenTransition.Cover)
  ```

## 4. Screen 2 — Report form (`scrReport`)
1. **+ New screen** → blank → rename `scrReport`.
2. Insert → **Edit form** → rename `frmReport`.
3. Properties → **Data source** = `Hazard Cases` · **Default mode** = *New*.
4. **Edit fields** → add: **Property**, **Resident**, **Hazard Type**, **Description**.
   (Property & Resident render as lookup combo boxes automatically.)
5. Select the **Description** card → make it multiline (its text input `Mode = TextMode.MultiLine`).
6. **Auto-generate the case reference** (hg_name is the required primary field, but the resident shouldn't type it):
   - Add the **Case Reference** (`hg_name`) field to the form, then select its card.
   - Unlock the card (Advanced → **Unlock**), set the card's **Update** property to:
     ```powerfx
     "HZ-" & Text(Now(), "yymmddHHmmss")
     ```
   - Set the card's **Visible** = `false` (hidden from the resident).
7. Add a **Submit** button below the form, `OnSelect`:
   ```powerfx
   SubmitForm(frmReport)
   ```
8. Select **frmReport**, set **OnSuccess**:
   ```powerfx
   // stamp the workflow fields the resident doesn't set
   Patch(
       'Hazard Cases',
       frmReport.LastSubmit,
       {
           hg_reporteddate: Now(),
           hg_status:    'Status (Hazard Case)'.New,
           hg_slastatus: 'SLA Status (Hazard Case)'.'On Track'
       }
   );
   Navigate(scrThanks, ScreenTransition.Fade)
   ```
   > Tip: type `'Status (` and let **IntelliSense** complete the exact choice-enum name — the suffix in brackets is the table name and can differ slightly.
9. Optional **OnFailure** (frmReport): `Notify("Something went wrong — please try again.", NotificationType.Error)`.

## 5. Screen 3 — Confirmation (`scrThanks`)
- **+ New screen** → rename `scrThanks`.
- Label: `"Thank you — your report has been logged."`
- Label showing the reference:
  ```powerfx
  "Your reference is " & frmReport.LastSubmit.hg_name
  ```
- Subtitle: `"A housing officer will review it. Emergency hazards are actioned within 24 hours; all others are investigated within 14 days (Awaab's Law)."`
- Button `"Done"` → `OnSelect`: `Navigate(scrWelcome, ScreenTransition.UnCover)`

## 6. Save, test, publish
- **File → Save** (name *Report a Hazard*).
- **Preview (F5)** → submit a test report → confirm a new record appears in the **HomeGuard Compliance** model-driven app (Hazard Cases, Status = New).
- **Publish**: File → Save → **Publish**.

## 7. (Optional) Add it to the solution
So it ships with everything else:
- Solutions → **HomeGuard – Awaab's Law Compliance** → **Add existing → App → Canvas app → Report a Hazard**.

---

### Design notes to mention in an interview
- Residents only set what they know (property, type, description); **workflow fields (status, dates, SLA) are stamped in code**, not left to the reporter.
- The reference number is generated server-agnostically at submit time.
- The same Dataverse tables back both the **resident canvas app** and the **officer model-driven app** — one data model, two tailored experiences.
