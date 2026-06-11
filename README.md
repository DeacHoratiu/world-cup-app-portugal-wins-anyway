# World Cup 2026 — Site + Notificări

Site cu programul complet, rezultate live și clasamente pentru Cupa Mondială 2026,
plus notificări pe telefon prin [ntfy.sh](https://ntfy.sh) — fără să ții vreun calculator deschis.

## Cum funcționează

- **`index.html`** — site-ul, găzduit gratuit pe GitHub Pages. Preia scorurile live
  din feed-ul public ESPN direct în browserul vizitatorului.
- **`notifier/notify.js`** — rulează automat pe GitHub Actions la fiecare 5 minute
  și trimite pe ntfy: alertă cu ~15 minute înainte de fiecare meci, la începutul
  meciului și la final, cu scorul (inclusiv penalty-uri în fazele eliminatorii).
- **Topicul ntfy NU apare nicăieri în cod** — e stocat ca GitHub Secret, deci
  repo-ul poate fi public fără griji.

## Instalare (o singură dată, ~5 minute)

1. **Creează repo-ul.** Pe GitHub: New repository → nume de ex. `worldcup-2026`
   → Public → Create. Urcă toate fișierele din acest folder
   (păstrează structura, inclusiv folderul ascuns `.github`).

2. **Adaugă secretul cu topicul ntfy.**
   Settings → Secrets and variables → Actions → New repository secret:
   - Name: `NTFY_TOPIC`
   - Secret: `horatiu-WorldCup-8f2a9c71-2026` (doar numele topicului, fără URL)

3. **Activează GitHub Pages.**
   Settings → Pages → Source: „Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save.
   În 1–2 minute site-ul e live la `https://NUMELE-TAU.github.io/worldcup-2026/`.

4. **Pornește notificările.**
   Tab-ul Actions → activează workflow-urile dacă GitHub îți cere →
   selectează „World Cup notifications" → „Run workflow" pentru un prim test.
   Prima rulare doar memorează starea curentă (nu trimite nimic);
   de la a doua rulare primești alerte la orice schimbare.

## De știut

- Cron-ul GitHub rulează „la fiecare 5 minute" cu aproximație — alertele pot
  întârzia câteva minute în orele aglomerate. Pentru precizie la minut,
  alternativa este Cloudflare Workers cu Cron Triggers.
- `notifier/state.json` e actualizat automat de bot după fiecare eveniment —
  commit-urile acelea sunt normale.
- După finala din 19 iulie poți opri workflow-ul: Actions →
  World Cup notifications → „⋯" → Disable workflow.
- Dacă vrei alt topic ntfy mai târziu, schimbi doar secretul — zero modificări în cod.
