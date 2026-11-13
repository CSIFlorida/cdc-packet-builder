# CDC+ Packet Builder

A free web app that lets CDC+ participants and representatives complete provider paperwork by answering one questionnaire. The home screen has a button for each packet:

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
| `core.js` | Shared engine: saved records, attachments, downloads, privacy |
| `app.css` | Look of all pages |
| `fill.js` | Vendor packet field mapping, plus the shared Good Moral and Direct Deposit fillers |
| `fill-employee.js` | Employee packet field mapping |
| `version.js` | App version number |
| `lib/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `forms/originals/*.pdf` | The blank forms |
| `forms/templates.js` | The same blank forms, embedded for offline use |
| `manifest.webmanifest`, `sw.js`, `icons/` | Install and offline support |
| `tools/build-templates.py` | Rebuilds `forms/templates.js` after a form is replaced |

## Updating

- **To change the app:** edit the files, then raise the version in `version.js` and in `sw.js` (`CACHE`). Returning users pick up the new version on their next visit.
- **When APD or the IRS releases a new form:**
  1. Replace the PDF in `forms/originals/`, keeping the same file name.
  2. Run `python3 tools/build-templates.py`.
  3. If the new form's layout or field names changed, update the coordinates and field names in `fill.js` as well.

## Disclaimer

This is an independent helper tool. It is not made, endorsed or reviewed by the Agency for Persons with Disabilities (APD), the CDC+ program or the IRS. Users must review every form before signing.
