# Rotate the GitHub token used by n8n (projects export)

**What this is:** n8n commits the projects catalogue to this repo (`rarepondstudios/rare-pond-studios`) using a GitHub **Personal Access Token (PAT)**. That token **expires**, and when it does the export silently stops — edits you make in NocoDB stop reaching the live site. This doc is the exact recovery procedure.

**You do NOT need to remember any of this.** A scheduled reminder fires ~8 days before expiry and will walk you through it. This file is the backup copy.

---

## Current token

| | |
|---|---|
| Created | 2026-07-15 |
| Lifetime | 90 days |
| **Expires** | **~2026-10-13** |
| Stored in | n8n → credential **"GitHub account"** (type: GitHub API) |
| Repo it writes to | `rarepondstudios/rare-pond-studios` |
| Reminder set for | 2026-10-05 (fires in the desktop app) |

> When you rotate, update the "Created / Expires / Reminder" rows above and commit, so this table always reflects the live token.

---

## Symptom that it expired

In n8n, the **projects export** workflow starts failing with a GitHub **401 / "Bad credentials"** error, and changes made in NocoDB no longer appear on the site after a few minutes. (You'll also get the n8n error-alert email, since that watchdog covers all workflows.)

---

## How to replace it — exact steps (~5 minutes)

### 1. Generate a new token on GitHub
1. Go to **https://github.com/settings/personal-access-tokens** (Settings → Developer settings → Personal access tokens → **Fine-grained tokens**).
2. Click **Generate new token**.
3. **Token name:** `n8n – projects export → rare-pond-studios`
4. **Expiration:** 90 days (or longer if you'd rather rotate less often; fine-grained max is ~1 year).
5. **Resource owner:** `rarepondstudios`
6. **Repository access:** **Only select repositories** → choose **`rare-pond-studios`**.
7. **Permissions → Repository permissions → Contents:** set to **Read and write**. (Leave everything else as "No access".)
8. Click **Generate token**, then **Copy** the token. You'll only see it once — copy it to your clipboard now.

### 2. Swap it into n8n
1. Open n8n → **http://localhost:5678** → left sidebar **Overview** → **Credentials** tab.
2. Open the credential named **"GitHub account"** (GitHub API).
3. In the **Access Token** field, delete the old value and **paste the new token**.
4. Leave **Server** = `https://api.github.com` and **User** = `rarepondstudios` unchanged.
5. Click **Save**.

### 3. Verify
1. Open the **projects export** workflow.
2. Click **Execute workflow** (manual run).
3. Confirm it finishes green with no GitHub error. (A no-op run — no catalogue change — is fine; it just proves auth works.)

### 4. Clean up
1. Back on GitHub, delete the **old, expired** token from the fine-grained tokens list.
2. Update the token table at the top of this file (new Created / Expires date) and commit.
3. Tell Claude the new expiration date so the reminder can be re-set for the next cycle.

---

## Notes
- The token is stored **encrypted** in n8n and reused automatically — you only paste it during the initial setup and each rotation.
- **Never commit the token to this repo** (public). It lives only in n8n.
- If you ever want to stop rotating entirely, the only "no-expiry" option is an old-style *classic* PAT, which is broader-scoped and less safe — not recommended. A yearly fine-grained token + this reminder is the better tradeoff.
