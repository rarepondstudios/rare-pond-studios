# Context for AI sessions in this repo

- Before asking Jack how anything in his environment works, read
  ~/Desktop/AI_System_Context/START-HERE.md, then INSTRUCTIONS-FOR-AI.md, and follow their read
  order. That folder is authoritative. Machine-wide rules: ~/.claude/CLAUDE.md; canonical pointer
  text: AI_System_Context/BOOTSTRAP.md.
- This repo's own source of truth: HANDOFF.md section 0, then OPERATIONS.md. Update HANDOFF.md
  section 0 after code changes here (it auto-mirrors hourly into the context folder).
- Website assets come ONLY from Current_Brand_Assets/Website Repository/ via the bts-automation
  syncs, never from the raw brand kit. See MEDIA-SPEC.md "Website source-of-truth rule".
- Journal every finished piece of work with the tool, never by hand:
  echo "- body" | python3 ~/bts-automation/journal_append.py --title "short title"
- Parallel sessions are normal: never git add -A, stage only the paths you changed, re-read
  shared files immediately before editing.
- No em dashes anywhere: docs, code comments, site copy, and Pages CMS label:/description:
  strings. Never put a root 404.html in this repo (Cloudflare Pages SPA).
