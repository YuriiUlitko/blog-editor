# Blog HTML Editor

A small, no-build WYSIWYG editor that writes HTML in the exact format the Framer
blog article component (`BlogArticleDetail` → `.adt-prose`) expects. Write your
post visually, click **Copy HTML**, and `Ctrl+V` it straight into the Framer CMS
**Body** field.

## What it does

- **Visual editing** that looks like the published article (same fonts, the
  red section numbers on `H2`, bullet dots, quote bars, etc.).
- **Toolbar** for headings (H2/H3), paragraphs, quotes, bullet & numbered lists,
  bold/italic, inline links, the **Go deeper** button, **images**, and dividers.
- **`</> HTML` toggle** — flip to the raw HTML source at any time to read, tweak,
  or paste. Flip back and the visual view updates.
- **Image uploads** to a Cloudflare R2 bucket (via a Worker), or just paste an
  image URL you already have.
- **Copy HTML** — clean, semantic markup ready for Framer.

## Run it locally

It's plain HTML/CSS/JS — open `index.html` in a browser, or serve the folder:

```bash
npx serve .        # or: python -m http.server
```

## Deploy to GitHub Pages

1. Push this folder to its own GitHub repo (`main` branch).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) publishes the site on
   every push. No secrets, no build step.

## Image uploads (Cloudflare R2)

The published site is **static and public**, so it can't hold R2 secret keys —
anything embedded in the page is readable by visitors. Uploads therefore go
through a tiny Cloudflare Worker that holds the access (as a bucket binding) and
returns the public URL. Setup is in [`worker/README.md`](worker/README.md).

Until the Worker is set up, you can still insert images by pasting a public image
URL into the image dialog.

> **Heads-up on GitHub Secrets:** they only exist during an Actions build, not in
> the visitor's browser. Since uploads happen live in the browser, the upload
> credential lives in the Worker (Cloudflare), not in GitHub. See
> [`worker/README.md`](worker/README.md).

## Output format (reference)

```html
<h2>Section heading</h2>          <!-- auto-numbered “/ 01” by the site CSS -->
<h3>Subheading</h3>
<p>Body text with <strong>bold</strong>, <em>italic</em>, and
   <a href="/somewhere">inline links</a>.</p>
<blockquote>A pulled quote.</blockquote>
<ul><li><strong>Label:</strong> a bullet point.</li></ul>
<ol><li>A numbered step.</li></ol>
<a class="adt-go-deeper" href="/blog/slug">
  <span class="adt-go-deeper-label">Go deeper</span>Article title
</a>
<figure>
  <img src="https://pub-xxxx.r2.dev/blog/photo.jpg" alt="…">
  <figcaption>Optional caption</figcaption>
</figure>
<hr>
```

> The Framer **Body** field must be a CMS **Text** field (plain text / HTML),
> **not** a *Formatted text* field.
