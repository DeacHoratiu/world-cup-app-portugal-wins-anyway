# World Cup 2026 — Fixtures, Live Scores & Notifications

A site with the full schedule, live results, and standings for the 2026 World Cup, plus push notifications via [ntfy.sh](https://ntfy.sh).

The website is hosted on GitHub Pages, while notifications are now handled by a Windows VM using Task Scheduler for more reliable 5-minute checks.

## How it works

* `index.html` — the site, hosted for free on GitHub Pages. It pulls live scores from ESPN's public feed directly in the visitor's browser.
* `notifier/notify.js` — checks ESPN's public scoreboard and sends ntfy alerts:

  * ~15 minutes before each match
  * at kick-off
  * at full time with the final score
  * including penalty shootout results in knockout stages
* `notifier/state.json` — stores which alerts were already sent, so notifications are not duplicated.
* `run-notifier.ps1` — PowerShell wrapper used by Windows Task Scheduler to run the notifier.

## Current setup

The live setup uses:

```text
GitHub Pages = frontend/site hosting
Windows VM Task Scheduler = notification runner
GitHub Actions = disabled backup/legacy workflow
```

This is more reliable than GitHub Actions cron because the VM triggers the script every 5 minutes directly.

## Website setup with GitHub Pages

1. Create the repo on GitHub.
2. Upload all files from this folder, keeping the folder structure.
3. Enable GitHub Pages:

   * Go to `Settings`
   * Open `Pages`
   * Source: `Deploy from a branch`
   * Branch: `main`
   * Folder: `/ (root)`
   * Save
4. The site will be available at:

```text
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

## Notification setup on Windows VM

Install Node.js on the VM, then clone or download this repo.

Expected folder structure:

```text
world-cup-app-portugal-wins-anyway-main/
│
├─ index.html
├─ run-notifier.ps1
└─ notifier/
   ├─ notify.js
   └─ state.json
```

Example `run-notifier.ps1`:

```powershell
Set-Location "C:\Users\'username'\Downloads\world-cup-app-portugal-wins-anyway-main"

$env:NTFY_TOPIC="your_ntfy_topic_name"

node ".\notifier\notify.js"
```

Create a Windows Task Scheduler task:

* Program/script:

```text
powershell.exe
```

* Arguments:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\Users\'username'\Downloads\world-cup-app-portugal-wins-anyway-main\run-notifier.ps1"
```

* Start in:

```text
C:\Users\'username'\Downloads\world-cup-app-portugal-wins-anyway-main
```

Recommended trigger:

```text
Repeat every 5 minutes
```

Recommended settings:

* Allow task to be run on demand
* If the task is already running: Do not start a new instance
* Enable task history for easier debugging

## Testing notifications

To test the full VM → ntfy → phone chain, temporarily add this line to `run-notifier.ps1`:

```powershell
$env:TEST_NOTIFY="1"
```

Then run the task manually from Task Scheduler.

After receiving the test notification, remove the line again.

## GitHub Actions

This repo may still contain a GitHub Actions workflow under:

```text
.github/workflows/worldcup-notify.yml
```

The workflow was originally used to run the notifier on a cron schedule.

It is now disabled because notifications are handled by the Windows VM instead.

To re-enable it as a fallback:

1. Go to the repo on GitHub.
2. Open the `Actions` tab.
3. Select `World Cup notifications`.
4. Enable the workflow.
5. Add the `NTFY_TOPIC` repository secret if needed:

   * `Settings`
   * `Secrets and variables`
   * `Actions`
   * `New repository secret`

Secret name:

```text
NTFY_TOPIC
```

Secret value:

```text
your_ntfy_topic_name
```

## Good to know

* `notifier/state.json` is important. It prevents duplicate alerts.
* If `state.json` already has `"initialized": true`, the setup confirmation notification will not be sent again unless `TEST_NOTIFY=1` is used.
* The notifier performs one check and exits. Task Scheduler is responsible for running it every 5 minutes.
* If the VM is turned off, notifications will not run.
* If you change the ntfy topic, update it in `run-notifier.ps1`.
* GitHub Pages can stay enabled even if GitHub Actions is disabled.
* After the final on 19 July, disable the Action in GitHub if applicable.
