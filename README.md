World Cup 2026 — Fixtures, Live Scores & Notifications

A site with the full schedule, live results, and standings for the 2026 World Cup, plus push notifications via ntfy.sh — no need to keep a computer running.

How it works


index.html — the site, hosted for free on GitHub Pages. Pulls live scores from ESPN's public feed directly in the visitor's browser.
notifier/notify.js — runs automatically on GitHub Actions every 5 minutes and sends ntfy alerts: ~15 minutes before each match, at kick-off, and at full time with the final score (including penalty shootout results in the knockout stages).
The ntfy topic does not appear anywhere in the code — it's stored as a GitHub Secret, so the repo can be public without any security concerns.


Setup (one-time, ~5 minutes)


Create the repo. On GitHub: New repository → pick a name (e.g. worldcup-2026) → Public → Create. Upload all files from this folder, keeping the folder structure (including the hidden .github folder).
Add the ntfy topic secret. Go to Settings → Secrets and variables → Actions → New repository secret:

Name: NTFY_TOPIC
Secret: your topic name (e.g. test1234123) — just the topic name, no URL



Enable GitHub Pages. Settings → Pages → Source: "Deploy from a branch" → Branch: main, folder / (root) → Save. Within 1–2 minutes the site will be live at https://YOUR-USERNAME.github.io/worldcup-2026/.
Start the notifications. Go to the Actions tab → enable workflows if GitHub prompts you → select "World Cup notifications" → click "Run workflow" for an initial test. The first run only snapshots the current state (no alerts sent); from the second run onwards you'll receive notifications for any changes.


Good to know


GitHub's cron runs "every 5 minutes" approximately — alerts may be a few minutes late during busy periods. For minute-level precision, the alternative is Cloudflare Workers with Cron Triggers.
notifier/state.json is updated automatically by the bot after each event — those commits are expected and normal.
After the final on 19 July you can stop the workflow: Actions → World Cup notifications → "⋯" → Disable workflow.
If you ever want a different ntfy topic, just update the secret — no code changes needed.
