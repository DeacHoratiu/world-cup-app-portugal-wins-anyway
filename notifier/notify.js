/**
 * World Cup 2026 — ntfy notifier
 * Runs on a GitHub Actions cron schedule. Checks ESPN's public scoreboard
 * and sends phone notifications via ntfy.sh:
 *   ⚽ 15 minutes before kickoff
 *   ⚽ when a match starts
 *   🏁 final result with the score
 *
 * The ntfy topic is read from the NTFY_TOPIC environment variable
 * (a GitHub Secret) so it never appears in the repository.
 *
 * State (which alerts were already sent) is kept in notifier/state.json,
 * committed back by the workflow after each run.
 */

const fs = require("fs");
const path = require("path");

const TOPIC = process.env.NTFY_TOPIC;
if (!TOPIC) {
  console.error("Missing NTFY_TOPIC environment variable (GitHub Secret).");
  process.exit(1);
}
const NTFY = `https://ntfy.sh/${TOPIC}`;
const API =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=400&dates=20260611-20260719";

const STATE_FILE = path.join(__dirname, "state.json");
const REMIND_MS = 15 * 60 * 1000; // kickoff reminder window

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    // First ever run: record current phases without notifying,
    // so games already finished don't trigger a flood of alerts.
    return { initialized: false, phase: {}, reminded: {} };
  }
}

async function notify(title, message) {
  const url = `${NTFY}?title=${encodeURIComponent(title)}&tags=soccer`;
  const res = await fetch(url, { method: "POST", body: message });
  if (!res.ok) console.error(`ntfy responded ${res.status} for: ${title}`);
  else console.log(`sent: ${title} — ${message}`);
}

function teams(comp) {
  const h = comp.competitors?.find((c) => c.homeAway === "home") || comp.competitors?.[0];
  const a = comp.competitors?.find((c) => c.homeAway === "away") || comp.competitors?.[1];
  return { h, a };
}

async function checkOnce(state, firstRun) {
  const res = await fetch(API);
  if (!res.ok) {
    console.error(`ESPN API responded ${res.status} — skipping this check.`);
    return;
  }
  const data = await res.json();
  const events = data.events || [];
  const now = Date.now();

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const id = String(ev.id);
    const st = comp.status?.type?.state || "pre"; // pre | in | post
    const prev = state.phase[id] || "pre";
    const { h, a } = teams(comp);
    if (!h || !a) continue;
    const hName = h.team?.displayName || "?";
    const aName = a.team?.displayName || "?";
    const round = ev.season?.slug || comp.notes?.[0]?.headline || "";

    // 1) kickoff reminder: 15 minutes before, only while still "pre"
    const kick = new Date(ev.date).getTime();
    if (!firstRun && st === "pre" && !state.reminded[id] && now >= kick - REMIND_MS && now < kick) {
      state.reminded[id] = true;
      const inMin = Math.max(1, Math.round((kick - now) / 60000));
      await notify("⚽ Starting soon", `${hName} – ${aName} kicks off in ~${inMin} min${round ? " · " + round : ""}`);
    }

    // 2) match started
    if (!firstRun && st === "in" && prev === "pre") {
      await notify("⚽ Kickoff", `${hName} – ${aName} is underway`);
    }

    // 3) final result
    if (!firstRun && st === "post" && prev !== "post") {
      let score = `${hName} ${h.score} – ${a.score} ${aName}`;
      // include penalty shootout if present (knockout rounds)
      if (h.shootoutScore != null && a.shootoutScore != null) {
        score += ` (${h.shootoutScore}–${a.shootoutScore} on penalties)`;
      }
      await notify("🏁 Full time", score);
    }

    state.phase[id] = st;
  }

  state.initialized = true;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`${new Date().toISOString()} · checked ${events.length} events`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const state = loadState();
  const firstRun = !state.initialized;

  // GitHub's cron is best-effort and often very late, so instead of relying on
  // it for frequency, each job stays alive for LOOP_MINUTES and polls every
  // 60 seconds. The cron only has to start the next shift before this one ends.
  const loopMinutes = Number(process.env.LOOP_MINUTES || 0);
  const endAt = Date.now() + loopMinutes * 60 * 1000;

  await checkOnce(state, firstRun); // firstRun only suppresses the very first check
  while (Date.now() < endAt) {
    await sleep(60 * 1000);
    await checkOnce(state, false);
  }

  if (firstRun) {
    // One-time confirmation so you know the whole chain works
    // (GitHub Secret → script → ntfy → phone) before the real alerts start.
    await notify(
      "World Cup 2026 ✅",
      "Notifications are set up correctly! You'll get alerts ~15 min before each match, at kickoff, and at full time with the score."
    );
  }

  console.log(`Shift complete · polled for ${loopMinutes} minute(s)`);
})().catch((e) => {
  console.error(e);
  process.exit(0); // never hard-fail the cron on transient errors
});
