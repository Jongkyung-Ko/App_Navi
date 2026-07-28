# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Ship to production by default

When finishing feature work the user wants it live — do not stop at an open PR:

1. Open/update the PR, then **merge** it into `master`.
2. Keep `main` in sync with `master` (`git push origin master:main`) so Railway autodeploy fires on whichever branch it watches.
3. Verify production (`https://app-navi-production.up.railway.app`) serves the new UI/API when possible.
4. If Railway did not pick up the push, say so clearly and ask for a one-time **Deploy Latest Commit** (or a `RAILWAY_TOKEN` GitHub secret for Actions).
