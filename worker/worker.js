/**
 * Cloudflare Worker — R2 image uploader for the Blog HTML Editor.
 *
 * The R2 bucket is attached as a binding (env.BUCKET), so this Worker
 * needs NO S3 access keys. The only optional secret is UPLOAD_TOKEN,
 * a simple gate so random people can't push files to your bucket.
 *
 * Deploy:  wrangler deploy   (see wrangler.toml + README.md)
 */

export default {
    async fetch(request, env) {
        const cors = {
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: cors });
        }

        // Optional auth (applies to both upload and list)
        if (env.UPLOAD_TOKEN) {
            const auth = request.headers.get("Authorization") || "";
            if (auth !== "Bearer " + env.UPLOAD_TOKEN) {
                return json({ error: "Unauthorized" }, 401, cors);
            }
        }

        const baseUrl = (env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

        // GET → list everything in the bucket (newest first) for the Gallery
        if (request.method === "GET") {
            const items = [];
            let cursor;
            do {
                const listing = await env.BUCKET.list({ prefix: "blog/", limit: 1000, cursor });
                for (const o of listing.objects) {
                    items.push({
                        key: o.key,
                        url: baseUrl + "/" + o.key,
                        uploaded: o.uploaded ? new Date(o.uploaded).getTime() : 0,
                    });
                }
                cursor = listing.truncated ? listing.cursor : undefined;
            } while (cursor);
            items.sort((a, b) => b.uploaded - a.uploaded);
            return json({ items }, 200, cors);
        }

        if (request.method !== "POST") {
            return json({ error: "Method not allowed" }, 405, cors);
        }

        let form;
        try {
            form = await request.formData();
        } catch (e) {
            return json({ error: "Expected multipart/form-data" }, 400, cors);
        }

        const file = form.get("file");
        if (!file || typeof file === "string") {
            return json({ error: "No file field" }, 400, cors);
        }

        // Build a tidy, collision-resistant key: blog/<timestamp>-<name>.<ext>
        const name = file.name || "image";
        const dot = name.lastIndexOf(".");
        const ext = dot > -1 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
        const base = (dot > -1 ? name.slice(0, dot) : name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "image";
        const key = `blog/${Date.now()}-${base}.${ext}`;

        await env.BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type || "application/octet-stream" },
        });

        return json({ url: baseUrl + "/" + key, key }, 200, cors);
    },
};

function json(obj, status, cors) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
    });
}
