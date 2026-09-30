# Devcon8 ID

Make your Devcon 8 card from your X profile. Type your X handle, pick a tagline and theme, then download the card or share it on X.

Live site: https://devcon8-id.vercel.app/

Unofficial, fan-made project. Not affiliated with, endorsed by, or connected to the Ethereum Foundation or Devcon. The Devcon name, logo and artwork belong to their respective owners.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole site: page, card drawing, sharing. The Devcon artwork and logo are built into this file. |
| `api/avatar.js` | Vercel function that fetches X profile pictures (`/api/avatar?u=handle`) |
| `og.png` | Link preview image shown when the site is shared on X, WhatsApp or LinkedIn |
| `assets/` | Original artwork and logo files (reference copies; the site doesn't load them) |
| `vercel.json` | Vercel settings: clean URLs and security and cache headers |
| `package.json` | Project info; tells Vercel to use modern JavaScript |

No build step and no dependencies.

## Deploy on Vercel

### If `devcon8-id` on Vercel is already connected to a GitHub repo
Replace the files in that repo with these files and commit. Vercel redeploys automatically, and https://devcon8-id-six.vercel.app shows the new site.

### If you're starting fresh
1. Create a GitHub repo (for example `devcon8-id`) and upload everything in this folder, keeping the `api` folder.
2. In Vercel, click **Add New → Project**, import the repo, keep the default settings (Framework Preset: **Other**, no build command) and click **Deploy**.
3. Vercel gives the project an address. If it differs from the one in `index.html`, update it (see **Site address** below).

## After deploying, check
1. https://devcon8-id-six.vercel.app/api/avatar?u=noelaiyub shows the profile picture.
2. On the site, typing a handle shows 'Profile picture loaded'.
3. Pasting the site link at https://www.opengraph.xyz shows the preview card.

## Site address

The address appears in `index.html` in two places:
- The meta tags at the top (link previews)
- `PUBLIC_URL_CONFIG` in the script (printed on every card and used in the share caption)

If the site moves to a new domain, update both and commit.

## Editing

Edit any file on GitHub and commit. Vercel redeploys in about 30 seconds. Every past version stays under **Deployments** in Vercel, where you can roll back with one click.
