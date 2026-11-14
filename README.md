# CSI Florida - CDC Application App

A free web app that lets CDC+ participants and representatives complete CDC+ paperwork by answering one questionnaire. The home screen has a button for each packet:

**CDC+ Participant Application** (`application.html`), for a consumer applying to the program:
1. Application Packet: CDC+ Application, Participant/Consultant Agreement, Representative Agreement (only with a CDC+ Representative), Emergency Back-up Plan
2. New Participant Training Affirmation, plus the Review Answer Sheet as an uploaded attachment
3. Enrollment Packet: Informed Consent for the F/EA, IRS Form 2678, IRS Form 8821 (followed by any proof of signing authority you upload), CDC+ Program Consent Form
4. Direct Deposit Request (Cons/Rep), only for reimbursement by direct deposit, plus the voided check as an uploaded attachment

The consultant-interview pages of the Application Packet are intentionally left out, because they are not submitted to CDC+.

**Consumer Database** (`consumers.html`): one profile per consumer, kept only in the browser on this device.
- Holds identity, address, guardian, CDC+ Representative, consultant, APD area and FFI, monthly budget, Support Plan and Cost Plan dates, approved Cost Plan services and the latest monthly statement.
- Attached documents (Budget Calculation Worksheet, Cost Plan, statements, etc.) are kept with the profile in IndexedDB.
- Every section's "Fill from the Consumer Database" list, and the profile's "Use this profile" buttons, fill that section from the profile.
- Export backup / Import cover the profiles, all packets and the documents. The backup file contains private data, so store it securely.

**CDC+ Purchasing Plan** (`purchasing.html`), written once the participant is approved and has a Budget Authorization Form:
- Fills APD's own Purchasing Plan workbook (Version 3.0-C, `forms/originals/purchasing_plan_3.0-C.xlsx`) and keeps every formula, drop-down and print setting.
- Covers Page 1 basics and reason for submitting, B. Needs, C.1 Services with emergency backups, C.2 Supplies, D. Cash, E. Savings, F. OTE/STE and the Page 6 budget summary.
- Calculates employer taxes (11.15% for DHEs with relationship 5) and the *EBU Added Cost*, which replaces Excel's macro button. Service lines spill onto Page 3A and 3B without ever splitting a critical service from its EBUs, and unused extra pages are hidden.
- Checks the plan against the Purchasing Plan Instructions (2012-12-19).
- Provider names, types and relationships can be filled in from the Employee and Vendor packets saved in the app.
- Download is an .xlsx file. APD's original .xls template is kept in `forms/originals/` for reference.

**Direct-Hire Employee Packet** (`employee.html`), in APD's order:
1. Employee Information Form (eff. 12/2/2014)
2. IRS Form W-4 (2026)
3. Form I-9 (Edition 01/20/25)
4. Level 2 Background Screening Clearance Letter (uploaded attachment)
5. Certification of Good Moral Character (updated 3/11/2016)
6. Direct Deposit / EFT Request (eff. 05/05/2016) and the voided check (uploaded attachment)
7. Change of Name/Address (eff. 11/2/2017), only when there is a name or address change

**Vendor / Independent Contractor Packet** (`vendor.html`):
1. Vendor Information Form (eff. 7/15/21)
2. IRS Form W-9 (Rev. March 2024)
3. Background screening letter (uploaded attachment)
4. Certification of Good Moral Character
5. Direct Deposit / EFT Request and the voided check (uploaded attachment)

Each packet downloads as one print-ready PDF in APD's order, or as separate forms that can still be edited. A participant's details entered in either packet can be reused in the other.

## Privacy

- **Nothing leaves the user's device.** There is no server, database, account or tracking.
- Records are saved in the user's own browser (localStorage) and the PDFs are generated on the device.
- Users can export a backup file and can erase everything with one button.
- Hosting the app only serves static files. You, as the host, never receive anyone's data.

## Publish it (pick one)

The app is a folder of static files. Upload the **whole folder** to any web host; no build step or server code is needed.

**Netlify Drop (easiest, free):**
1. Go to https://app.netlify.com/drop
2. Drag this folder onto the page.
3. You get a link like `https://something.netlify.app`. You can rename it in Site settings.

**GitHub Pages (free):**
1. Create a new public repository and upload all files in this folder, keeping the subfolders.
2. In the repository, open Settings → Pages, choose "Deploy from a branch", then branch `main`, folder `/ (root)`.
3. Your link will be `https://<your-user>.github.io/<repo-name>/`.

**Your own website:**
Copy the folder to your web server, for example into `/cdc-packet/`, and link to `https://yoursite.org/cdc-packet/`.

HTTPS is required for the "Install app" button and for offline use. All three options above provide it.

## How consumers use it

- Open the link on a phone, tablet or computer.
- Optional: click **Install app** in Chrome or Edge, or on iPhone use Share → **Add to Home Screen**. After the first visit the app works offline.
- If you prefer to email the app instead of hosting it, zip this folder and send it. The user unzips it and double-clicks `index.html`. Every feature works except install and offline caching.

## Files

| File | Purpose |
|---|---|
| `index.html` | Home screen with a button for each packet |
| `employee.html`, `employee.js` | Direct-Hire Employee questionnaire and its checks |
| `vendor.html`, `vendor.js` | Vendor / IC questionnaire and its checks |
| `application.html`, `application.js` | Participant Application questionnaire and its checks |
| `purchasing.html`, `purchasing.js`, `fill-purchasing.js` | Purchasing Plan questionnaire, line tables, calculations and Excel writer |
| `lib/exceljs.min.js` | Excel library (ExcelJS 4.4.0, MIT license) |
| `fill-application.js` | Application & Enrollment packet field mapping (text placed by position on the flat IRS and scanned APD pages) |
| `forms/tpl-*.js` | Blank forms embedded per packet, so each page loads only its own forms |
| `consumers.html`, `consumers.js` | Consumer Database |
| `docs.js` | Document store (IndexedDB) for attached PDFs and images |
| `grid.js` | Editable line tables (Purchasing Plan, Cost Plan services) |
| `core.js` | Shared engine: saved records, attachments, downloads, privacy |
| `app.css` | Look of all pages |
| `fill.js` | Vendor packet field mapping, plus the shared Good Moral and Direct Deposit fillers |
| `fill-employee.js` | Employee packet field mapping |
| `version.js` | App version number |
| `lib/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `forms/originals/*.pdf` | The blank forms |
| `manifest.webmanifest`, `sw.js`, `icons/` | Install and offline support |
| `tools/build-templates.py` | Rebuilds the `forms/tpl-*.js` bundles after a form is replaced |

## Updating

- **To change the app:** edit the files, then raise the version in `version.js` and in `sw.js` (`CACHE`). Returning users pick up the new version on their next visit.
- **When APD or the IRS releases a new form:**
  1. Replace the PDF in `forms/originals/`, keeping the same file name.
  2. Run `python3 tools/build-templates.py`.
  3. If the new form's layout or field names changed, update the coordinates and field names in `fill.js` as well.

## Disclaimer

This is an independent helper tool. It is not made, endorsed or reviewed by the Agency for Persons with Disabilities (APD), the CDC+ program or the IRS. Users must review every form before signing.
