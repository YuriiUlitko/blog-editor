# R2 Image Uploader Worker

A tiny Cloudflare Worker that receives an image from the editor and stores it
in your R2 bucket. **This is where your credentials live — never in the editor
or in GitHub.** The bucket is attached as a binding, so you don't even need S3
access keys.

## One-time setup

1. **Install Wrangler** (Cloudflare's CLI) and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create an R2 bucket** (if you don't have one):
   Cloudflare dashboard → R2 → *Create bucket* (e.g. `digital-ink-blog`).

3. **Enable public access** so images can be displayed:
   R2 → your bucket → *Settings* → *Public access* → enable the `r2.dev` URL
   (or connect a custom domain). Copy that URL.

4. **Edit `wrangler.toml`** — fill the three `CHANGE-ME` values:
   - `bucket_name` → your bucket name
   - `PUBLIC_BASE_URL` → the public URL from step 3 (no trailing slash)
   - `ALLOWED_ORIGIN` → your GitHub Pages origin, e.g. `https://yourname.github.io`
     (leave as `*` while testing)

5. *(Optional but recommended)* **Set an upload token** so only you can upload:
   ```bash
   wrangler secret put UPLOAD_TOKEN
   ```
   Enter any random string. You'll paste the same string into the editor's
   ⚙ Settings → *Upload token*.

6. **Deploy:**
   ```bash
   wrangler deploy
   ```
   Wrangler prints the Worker URL, e.g.
   `https://blog-image-uploader.yourname.workers.dev`.

7. In the editor, open **⚙ Settings** and paste that Worker URL (and the token
   if you set one). Done — image uploads now go straight to R2.

## Where each value goes — quick reference

| Value | Lives in | Public? |
|-------|----------|---------|
| R2 bucket binding | `wrangler.toml` (Cloudflare) | no keys involved |
| `PUBLIC_BASE_URL` | `wrangler.toml` `[vars]` | yes (it's just the public URL) |
| `ALLOWED_ORIGIN` | `wrangler.toml` `[vars]` | yes |
| `UPLOAD_TOKEN` | `wrangler secret put` (Cloudflare) | **secret, encrypted** |
| Worker URL + token | editor ⚙ Settings (browser localStorage) | local to your browser |

> **Why not GitHub Secrets?** GitHub Secrets are only readable during an Actions
> build, not by JavaScript in the visitor's browser. The editor uploads at
> runtime from the browser, so the secret has to live in the Worker instead.
