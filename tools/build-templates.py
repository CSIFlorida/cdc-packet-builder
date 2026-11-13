"""Rebuild the embedded form bundles in forms/ after replacing a blank form in forms/originals/.
Run from the app folder:  python3 tools/build-templates.py
Keep the same file names. If a new form's layout or field names changed, its fill-*.js file must be updated too."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
bundles = {
    'common': {'gm': 'good_moral.pdf', 'dd': 'direct_deposit.pdf'},
    'vendor': {'vendor': 'ic_vendor.pdf', 'w9': 'w9_worker.pdf'},
    'employee': {'eif': 'employee_info.pdf', 'w4': 'w4.pdf', 'i9': 'i9.pdf', 'chg': 'change_name_address.pdf'},
    'application': {'apppkt': 'application_packet.pdf', 'enroll': 'enrollment_forms.pdf', 'training': 'training_affirmation.pdf'},
}
for name, files in bundles.items():
    data = {k: base64.b64encode((root / 'forms/originals' / f).read_bytes()).decode() for k, f in files.items()}
    (root / f'forms/tpl-{name}.js').write_text('/* Blank forms, embedded so the app also works offline */\nwindow.TEMPLATES_B64 = Object.assign(window.TEMPLATES_B64 || {}, ' + json.dumps(data) + ');\n')
    print(f'forms/tpl-{name}.js rebuilt')
old = root / 'forms/templates.js'
if old.exists(): old.unlink()
