# ShadowFox SC – CardTrack MVP (Cloudflare Pages - zero settings)

## Deploy (no terminal)
1. Create a new GitHub repo and upload *all files in this folder*.
2. In Cloudflare Dashboard: Workers & Pages → Create → Pages → Connect to Git.
3. Select your repo and click Deploy.

Cloudflare should auto-detect Vite and build to `dist/`.

## Configure backend URL (optional)
- Edit `.env` and set `VITE_API_URL` to your backend URL (Render), then push the change.

## Mobile install (free)
- Android: open your Pages URL in Chrome → ⋮ → Install app
- iPhone: open in Safari → Share → Add to Home Screen
