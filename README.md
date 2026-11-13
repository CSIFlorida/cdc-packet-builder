# CDC+ Vendor / IC Packet Builder

A free web app that lets CDC+ participants and representatives complete the **Vendor / Independent Contractor packet** by answering one questionnaire. It fills these forms on their original layouts:

1. Vendor Information Form (eff. 7/15/21)
2. IRS Form W-9 (Rev. March 2024)
3. Certification of Good Moral Character (updated 3/11/2016)
4. Direct Deposit / EFT Request (eff. 05/05/2016)

It then downloads one print-ready packet in APD's order. The background screening letter and voided check can be attached and are merged in. The packet can also be downloaded as separate forms that can still be edited.

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
| `index.html` | The app page |
| `app.css`, `app.js` | Look and behavior of the questionnaire |
| `fill.js` | Field mapping: places each answer on each form |
| `lib/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `forms/originals/*.pdf` | The blank forms |
| `forms/templates.js` | The same blank forms, embedded for offline use |
| `manifest.webmanifest`, `sw.js`, `icons/` | Install and offline support |
| `tools/build-templates.py` | Rebuilds `forms/templates.js` after a form is replaced |

## Updating

- **To change the app:** edit the files, then raise the version in `app.js` (`VERSION`) and in `sw.js` (`CACHE`). Returning users pick up the new version on their next visit.
- **When APD or the IRS releases a new form:**
  1. Replace the PDF in `forms/originals/`, keeping the same file name.
  2. Run `python3 tools/build-templates.py`.
  3. If the new form's layout or field names changed, update the coordinates and field names in `fill.js` as well.

## Disclaimer

This is an independent helper tool. It is not made, endorsed or reviewed by the Agency for Persons with Disabilities (APD), the CDC+ program or the IRS. Users must review every form before signing.
