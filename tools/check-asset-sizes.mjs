#!/usr/bin/env node
/* check-asset-sizes.mjs: no committed file may break the Cloudflare Pages deploy.
   WHY: Pages hard-rejects any single asset over 25 MiB and that fails the WHOLE
   deployment, silently: the site keeps serving the previous build (this froze
   jackcarlsen.com for a day on 2026-08-09 when a 45 MiB web reel was committed;
   HANDOFF 0.0.-37D). This catches the class before a push.
   Thresholds: WARN over 24 MiB (close to the cap, e.g. the legacy vfx-reel.mp4
   which sits 75 KB under it; warnings never fail the run, so legacy near-cap
   files do not block unrelated commits), FAIL over 25 MiB (the deploy WILL break).
   Run:  node tools/check-asset-sizes.mjs [repoRoot]
   Exit 0 = deployable (warnings allowed), exit 1 = at least one file over the cap. */
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const WARN = 24 * 1024 * 1024;       // 25165824
const FAIL = 25 * 1024 * 1024;       // 26214400, the Cloudflare Pages per-file cap

const files = execFileSync('git', ['-C', root, 'ls-files', '-z'], { maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8').split('\0').filter(Boolean);

const mib = n => (n / 1048576).toFixed(2) + ' MiB';
let warns = 0, fails = 0;
for (const f of files) {
  let size;
  try { size = statSync(join(root, f)).size; } catch { continue; } // deleted in worktree
  if (size > FAIL) { console.log(`FAIL ${mib(size)}  ${f}   (over the 25 MiB Pages cap, the deploy WILL fail)`); fails++; }
  else if (size > WARN) { console.log(`WARN ${mib(size)}  ${f}   (within ${mib(FAIL - size)} of the 25 MiB Pages cap)`); warns++; }
}
console.log(`${files.length} tracked files checked, ${fails} over the cap, ${warns} near it`);
if (fails) process.exitCode = 1;
