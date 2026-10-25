#!/bin/sh
# Installs this repo's git hooks (2026-10-25). Safe to re-run. Hooks live in .git/hooks, which git does not track,
# so a fresh clone needs this once: sh tools/install-hooks.sh
HOOK="$(git rev-parse --git-dir)/hooks/pre-commit"
cat > "$HOOK" <<'EOF'
#!/bin/sh
# rp_site_work pre-commit (installed by tools/install-hooks.sh): when a rentals script or stylesheet is in the commit,
# give rentals/index.html fresh ?v= versions for it (tools/stamp-rentals-assets.py) (only the staged copy of the page is changed).
if git diff --cached --name-only | grep -qE '^rentals/assets/(app\.js|availability\.js|styles\.css)$'; then
  RP_STAMP_STAGED=1 python3 tools/stamp-rentals-assets.py
fi
exit 0
EOF
chmod +x "$HOOK"
echo "installed $HOOK"
