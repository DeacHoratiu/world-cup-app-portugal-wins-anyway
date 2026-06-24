/**
 * World Cup 2026 — adaptive ntfy notifier for a Windows Task Scheduler job.
 *
 * Task Scheduler starts this script every five minutes. During quiet periods it
 * makes one ESPN request and exits. Near a match it stays alive for four minutes
 * and polls every minute. Kickoff alerts use the official event time so they are
 * not delayed until ESPN changes the match state to "in".
 */

const fs = require("fs");
const path = require("path");

const TOPIC = process.env.NTFY_TOPIC;
if (!TOPIC) {
  console.error("Missing NTFY_TOPIC environment variable.");
  process.exit(1);
}

const NTFY = `https://ntfy.sh/${TOPIC}`;
const API_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=100";
const STATE_FILE = path.join(__dirname, "state.json");

const MINUTE = 60 * 1000;
const REMIND_MS = 15 * MINUTE;
const NEAR_BEFORE_MS = 20 * MINUTE;
const NEAR_AFTER_MS = 4 * 60 * MINUTE;
const KICKOFF_LOOKAHEAD_MS = 6 * MINUTE;
const ACTIVE_RUN_MS = 4 * MINUTE;
const POLL_MS = MINUTE;

function normalizeState(state) {
  state.phase ||= {};
  state.reminded ||= {};
  state.kickoff ||= {};
  return state;
}

function loadState() {
  try {
    return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
  } catch {
    return { initialized: false, phase: {}, reminded: {}, kickoff: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function etDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

function apiUrl() {
  const now = Date.now();
  const day = 24 * 60 * MINUTE;
  return `${API_BASE}&dates=${etDateKey(new Date(now - day))}-${etDateKey(new Date(now + day))}`;
}

async function notify(title, message) {
  const url = `${NTFY}?title=${encodeURIComponent(title)}&tags=soccer`;
  const res = await fetch(url, { method: "POST", body: message });
  if (!res.ok) console.error(`ntfy responded ${res.status} for: ${title}`);
  else console.log(`sent: ${title} — ${message}`);
}

function teams(comp) {
  const h = comp.competitors?.find((team) => team.homeAway === "home") || comp.competitors?.[0];
  const a = comp.competitors?.find((team) => team.homeAway === "away") || comp.competitors?.[1];
  return { h, a };
}

async function sendKickoff(state, game, message) {
  if (state.kickoff[game.id]) return;

  // Reserve and save before sending so overlapping checks cannot duplicate it.
  state.kickoff[game.id] = true;
  saveState(state);
  await notify("⚽ Kickoff", message);
}

async function checkOnce(state, firstRun) {
  const res = await fetch(apiUrl());
  if (!res.ok) {
    console.error(`ESPN API responded ${res.status} — skipping this check.`);
    return [];
  }

  const data = await res.json();
  const events = data.events || [];
  const games = [];
  const now = Date.now();

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;

    const id = String(ev.id);
    const currentPhase = comp.status?.type?.state || "pre";
    const previousPhase = state.phase[id] || "pre";
    const { h, a } = teams(comp);
    if (!h || !a) continue;

    const hName = h.team?.displayName || "?";
    const aName = a.team?.displayName || "?";
    const round = ev.season?.slug || comp.notes?.[0]?.headline || "";
    const kick = new Date(ev.date).getTime();
    const game = { id, kick, hName, aName, round, state: currentPhase };
    games.push(game);

    if (
      !firstRun &&
      currentPhase === "pre" &&
      !state.reminded[id] &&
      now >= kick - REMIND_MS &&
      now < kick
    ) {
      state.reminded[id] = true;
      const inMinutes = Math.max(1, Math.round((kick - now) / MINUTE));
      await notify(
        "⚽ Starting soon",
        `${hName} – ${aName} kicks off in ~${inMinutes} min${round ? " · " + round : ""}`
      );
    }

    // Fallback: if a scheduled timer was missed, ESPN's live state still sends
    // the alert. Normally the exact-time timer has already reserved this ID.
    if (
      !firstRun &&
      currentPhase === "in" &&
      previousPhase === "pre" &&
      !state.kickoff[id]
    ) {
      await sendKickoff(state, game, `${hName} – ${aName} is underway`);
    }

    if (!firstRun && currentPhase === "post" && previousPhase !== "post") {
      let score = `${hName} ${h.score} – ${a.score} ${aName}`;
      if (h.shootoutScore != null && a.shootoutScore != null) {
        score += ` (${h.shootoutScore}–${a.shootoutScore} on penalties)`;
      }
      await notify("🏁 Full time", score);
    }

    state.phase[id] = currentPhase;
  }

  state.initialized = true;
  saveState(state);
  console.log(`${new Date().toISOString()} · checked ${events.length} nearby events`);
  return games;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isNearMatch(games) {
  const now = Date.now();
  return games.some(
    (game) =>
      game.state === "in" ||
      (game.state !== "post" &&
        now >= game.kick - NEAR_BEFORE_MS &&
        now <= game.kick + NEAR_AFTER_MS)
  );
}

function scheduleKickoffs(state, games, firstRun) {
  if (firstRun) return [];
  const now = Date.now();

  return games
    .filter(
      (game) =>
        game.state === "pre" &&
        !state.kickoff[game.id] &&
        game.kick >= now &&
        game.kick - now <= KICKOFF_LOOKAHEAD_MS
    )
    .map(async (game) => {
      const waitMs = Math.max(0, game.kick - Date.now());
      console.log(
        `scheduled kickoff alert for ${game.hName} - ${game.aName} in ${Math.ceil(waitMs / 1000)}s`
      );
      await sleep(waitMs);
      await sendKickoff(
        state,
        game,
        `${game.hName} – ${game.aName} is scheduled to kick off now${
          game.round ? " · " + game.round : ""
        }`
      );
    });
}

async function pollNearby(state, initialGames) {
  if (!isNearMatch(initialGames)) return;

  const endAt = Date.now() + ACTIVE_RUN_MS;
  while (Date.now() < endAt) {
    await sleep(Math.min(POLL_MS, Math.max(0, endAt - Date.now())));
    await checkOnce(state, false);
  }
}

(async () => {
  const state = loadState();
  const firstRun = !state.initialized;
  const games = await checkOnce(state, firstRun);
  const kickoffTimers = scheduleKickoffs(state, games, firstRun);

  // The timer and the short live polling shift run together. Outside match
  // windows both arrays are empty and the process exits immediately.
  await Promise.all([pollNearby(state, games), ...kickoffTimers]);

  if (firstRun) {
    await notify(
      "World Cup 2026 ✅",
      "Notifications are set up correctly! You'll get alerts ~15 min before each match, at kickoff, and at full time with the score."
    );
  }

  console.log(
    `Shift complete · ${isNearMatch(games) ? "adaptive polling was active" : "quiet period"}`
  );
})().catch((error) => {
  console.error(error);
  process.exit(0); // do not hard-fail Task Scheduler on transient network errors
});
