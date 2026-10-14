# Who can read the recorded tries (replays) — decision pending

Written 2026-10-15. Today anyone who knows the database address can read `replays/`: every tap of
every named player, with timing. The address is in the public game code. The dashboard game viewer
(`dash/watch.js`) reads replays straight from the browser and depends on this.

## Options

1. **Leave it readable.** Nothing to do. Acceptable for a family app with no sensitive content.
2. **Lock it, keep the viewer working.** Needs a login on the dashboard (Firebase Authentication,
   e.g. Google sign-in for Dennis only) and rules like `".read": "auth != null && auth.uid === '<Dennis>'"`.
   The most work; the right choice if people outside the family ever play.
3. **Lock it, no viewer.** Rules `replays: { ".read": false }`; the daily cleanup reads with a key.
   The viewer stops working.

## Steps for option 3 (or the cleanup part of option 2)

1. Firebase console → Project settings → Service accounts → Database secrets → show and copy the
   secret. (It acts as an admin key: never put it in code, the game or the dashboard.)
2. GitHub → this repository → Settings → Secrets and variables → Actions → New repository secret:
   name `FIREBASE_DB_SECRET`, value the secret.
3. Only then publish the rules with replays locked. `tools/prune_replays.js` already sends the key
   when `FIREBASE_DB_SECRET` is set; without it, it works as before on readable replays.
