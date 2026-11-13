"""Rebuild forms/templates.js after replacing a blank form in forms/originals/.
Run from the app folder:  python3 tools/build-templates.py
Keep the same file names. If the new form's layout or field names changed, fill.js must be updated too."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
names = {'vendor': 'ic_vendor.pdf', 'w9': 'w9_worker.pdf', 'gm': 'good_moral.pdf', 'dd': 'direct_deposit.pdf',
         'eif': 'employee_info.pdf', 'w4': 'w4.pdf', 'i9': 'i9.pdf', 'chg': 'change_name_address.pdf'}
data = {k: base64.b64encode((root / 'forms/originals' / f).read_bytes()).decode() for k, f in names.items()}
(root / 'forms/templates.js').write_text('/* Blank official forms, embedded so the app also works offline / opened from disk */\nwindow.TEMPLATES_B64=' + json.dumps(data) + ';\n')
print('forms/templates.js rebuilt')
