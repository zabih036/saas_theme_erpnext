from pathlib import Path
import re
import subprocess

path = Path("saas_theme/public/js/custom.js")
text = path.read_text(encoding="utf-8")

# All historical refinement CSS/JS referenced from this bundle is already
# embedded in custom.css/custom.js. Keep the old loader code harmless without
# retaining numbered compatibility files or causing HTTP 404 requests.
text = re.sub(
    r"/assets/saas_theme/css/[^\"']+",
    "data:text/css,",
    text,
)
text = re.sub(
    r"/assets/saas_theme/js/[^\"']+",
    "data:text/javascript,",
    text,
)

path.write_text(text, encoding="utf-8")

remaining = re.findall(r"/assets/saas_theme/(?:css|js)/[^\"'\s)]+", text)
if remaining:
    raise SystemExit(f"Obsolete theme asset URLs remain: {sorted(set(remaining))}")

subprocess.run(["node", "--check", str(path)], check=True)
print("Obsolete runtime theme loaders neutralized; custom.js syntax is valid.")
