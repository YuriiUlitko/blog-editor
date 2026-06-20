/* ============================================================
   Blog HTML Editor — logic
   Produces clean HTML that matches BlogArticleDetail.framer.tsx
   (.adt-prose). Copy it and Ctrl+V into the Framer CMS body field.
   ============================================================ */

(function () {
    "use strict";

    const $ = (sel) => document.querySelector(sel);

    const editor = $("#editor");
    const raw = $("#raw");
    const toolbar = $("#toolbar");
    const btnToggle = $("#btn-toggle");
    const toastEl = $("#toast");

    // Enter creates <p> instead of <div>
    try {
        document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {}

    /* ---------- Starter content ---------- */
    editor.innerHTML = [
        "<h2>The visibility trap</h2>",
        "<p>Most tattoo artists who struggle with bookings don't have a talent problem. They have a <strong>visibility problem</strong> — or worse, a conversion problem they've misdiagnosed as a visibility problem.</p>",
        "<blockquote>Advertising amplifies what's already there.</blockquote>",
        "<ul><li><strong>Calendar empty:</strong> start with Google Search ads — the intent is already there.</li><li><strong>Strong content, low reach:</strong> run Meta awareness ads to a local audience.</li></ul>",
        '<a class="adt-go-deeper" href="/blog/meta-ads-for-tattoo-artists" contenteditable="false"><span class="adt-go-deeper-label">Go deeper</span>Meta Ads for Tattoo Artists: The Booking Framework</a>',
        "<p><br></p>",
    ].join("");
    normalize();

    /* ============================================================
       Selection helpers — keep the caret while clicking toolbar
       ============================================================ */
    let savedRange = null;

    document.addEventListener("selectionchange", () => {
        const sel = window.getSelection();
        if (sel.rangeCount && editor.contains(sel.anchorNode)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    });

    function restoreSelection() {
        editor.focus();
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    // Stop toolbar buttons from stealing the selection on click
    toolbar.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) e.preventDefault();
    });

    /* ============================================================
       Toolbar — block / list / inline formatting
       ============================================================ */
    toolbar.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;

        if (b.dataset.block) {
            editor.focus();
            document.execCommand("formatBlock", false, b.dataset.block);
        } else if (b.dataset.list) {
            editor.focus();
            document.execCommand(
                b.dataset.list === "ul" ? "insertUnorderedList" : "insertOrderedList"
            );
        } else if (b.dataset.inline) {
            editor.focus();
            document.execCommand(b.dataset.inline);
        }
    });

    $("#btn-link").addEventListener("click", () => {
        const url = prompt("Link URL:");
        if (!url) return;
        restoreSelection();
        document.execCommand("createLink", false, url);
    });

    $("#btn-hr").addEventListener("click", () => {
        restoreSelection();
        document.execCommand("insertHorizontalRule");
    });

    /* ============================================================
       Insert / replace block nodes (go-deeper, figure)
       ============================================================ */
    let editingNode = null; // set when double-click editing an existing block

    function topLevelBlockFromSelection() {
        const sel = window.getSelection();
        let node = sel.anchorNode;
        while (node && node.parentNode !== editor) node = node.parentNode;
        return node && node.parentNode === editor ? node : null;
    }

    function placeCaret(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        editor.focus();
    }

    function insertBlockNode(el) {
        if (editingNode) {
            editingNode.replaceWith(el);
            editingNode = null;
            return;
        }
        restoreSelection();
        const block = topLevelBlockFromSelection();
        if (block) block.after(el);
        else editor.appendChild(el);

        const p = document.createElement("p");
        p.innerHTML = "<br>";
        el.after(p);
        placeCaret(p);
    }

    function buildGoDeeper(url, title) {
        const a = document.createElement("a");
        a.className = "adt-go-deeper";
        a.setAttribute("href", url);
        a.setAttribute("contenteditable", "false");
        const span = document.createElement("span");
        span.className = "adt-go-deeper-label";
        span.textContent = "Go deeper";
        a.appendChild(span);
        a.appendChild(document.createTextNode(title));
        return a;
    }

    function buildFigure(src, alt, caption) {
        const fig = document.createElement("figure");
        fig.setAttribute("contenteditable", "false");
        const img = document.createElement("img");
        img.src = src;
        img.alt = alt || "";
        fig.appendChild(img);
        if (caption) {
            const fc = document.createElement("figcaption");
            fc.textContent = caption;
            fig.appendChild(fc);
        }
        return fig;
    }

    function normalize() {
        // Lock structural blocks so their internals can't be mangled
        editor
            .querySelectorAll(".adt-go-deeper, figure")
            .forEach((el) => el.setAttribute("contenteditable", "false"));
    }

    // Double-click an existing go-deeper / figure to edit it
    editor.addEventListener("dblclick", (e) => {
        const gd = e.target.closest(".adt-go-deeper");
        if (gd) {
            editingNode = gd;
            openGoDeeper({
                url: gd.getAttribute("href") || "",
                title: (gd.lastChild && gd.lastChild.textContent) || "",
            });
            return;
        }
        const fig = e.target.closest("figure");
        if (fig) {
            editingNode = fig;
            const img = fig.querySelector("img");
            const cap = fig.querySelector("figcaption");
            openImage({
                url: (img && img.getAttribute("src")) || "",
                alt: (img && img.getAttribute("alt")) || "",
                caption: (cap && cap.textContent) || "",
            });
        }
    });

    /* ============================================================
       Modals
       ============================================================ */
    function show(id) {
        $(id).hidden = false;
    }
    function hideAll() {
        document.querySelectorAll(".overlay").forEach((o) => (o.hidden = true));
    }

    document.querySelectorAll("[data-close]").forEach((b) =>
        b.addEventListener("click", () => {
            editingNode = null;
            hideAll();
        })
    );
    document.querySelectorAll(".overlay").forEach((ov) =>
        ov.addEventListener("click", (e) => {
            if (e.target === ov) {
                editingNode = null;
                hideAll();
            }
        })
    );

    /* ----- Go deeper modal ----- */
    function openGoDeeper(data) {
        $("#gd-url").value = (data && data.url) || "";
        $("#gd-title").value = (data && data.title) || "";
        show("#ov-godeeper");
        setTimeout(() => $("#gd-url").focus(), 30);
    }
    $("#btn-godeeper").addEventListener("click", () => {
        editingNode = null;
        openGoDeeper();
    });
    $("#gd-insert").addEventListener("click", () => {
        const url = $("#gd-url").value.trim();
        const title = $("#gd-title").value.trim();
        if (!url || !title) {
            toast("Both URL and title are required.");
            return;
        }
        insertBlockNode(buildGoDeeper(url, title));
        hideAll();
    });

    /* ----- Image modal ----- */
    const imgUrl = $("#img-url");
    const imgInsert = $("#img-insert");
    const imgStatus = $("#img-status");

    function openImage(data) {
        imgUrl.value = (data && data.url) || "";
        $("#img-alt").value = (data && data.alt) || "";
        $("#img-caption").value = (data && data.caption) || "";
        imgStatus.textContent = "Uploads to your R2 bucket via the Worker.";
        imgStatus.classList.remove("error");
        refreshImgInsert();
        show("#ov-image");
    }
    $("#btn-image").addEventListener("click", () => {
        editingNode = null;
        openImage();
    });

    function refreshImgInsert() {
        imgInsert.disabled = !imgUrl.value.trim();
    }
    imgUrl.addEventListener("input", refreshImgInsert);

    imgInsert.addEventListener("click", () => {
        const url = imgUrl.value.trim();
        if (!url) return;
        insertBlockNode(
            buildFigure(url, $("#img-alt").value.trim(), $("#img-caption").value.trim())
        );
        hideAll();
    });

    // File picking + drag/drop
    const drop = $("#img-drop");
    const fileInput = $("#img-file");
    drop.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        if (fileInput.files[0]) handleUpload(fileInput.files[0]);
    });
    ["dragenter", "dragover"].forEach((ev) =>
        drop.addEventListener(ev, (e) => {
            e.preventDefault();
            drop.classList.add("drag");
        })
    );
    ["dragleave", "drop"].forEach((ev) =>
        drop.addEventListener(ev, (e) => {
            e.preventDefault();
            drop.classList.remove("drag");
        })
    );
    drop.addEventListener("drop", (e) => {
        const f = e.dataTransfer.files[0];
        if (f) handleUpload(f);
    });

    async function handleUpload(file) {
        const workerUrl = localStorage.getItem("r2WorkerUrl");
        if (!workerUrl) {
            imgStatus.textContent =
                "No Worker URL set — open ⚙ Settings, or just paste an image URL below.";
            imgStatus.classList.add("error");
            return;
        }
        imgStatus.classList.remove("error");
        imgStatus.textContent = "Uploading " + file.name + "…";
        try {
            const token = localStorage.getItem("r2UploadToken") || "";
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(workerUrl, {
                method: "POST",
                headers: token ? { Authorization: "Bearer " + token } : {},
                body: fd,
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            if (!data.url) throw new Error("No URL returned");
            imgUrl.value = data.url;
            refreshImgInsert();
            imgStatus.textContent = "Uploaded ✓";
        } catch (err) {
            imgStatus.classList.add("error");
            imgStatus.textContent = "Upload failed: " + err.message;
        }
    }

    /* ----- Settings modal ----- */
    $("#btn-settings").addEventListener("click", () => {
        $("#set-url").value = localStorage.getItem("r2WorkerUrl") || "";
        $("#set-token").value = localStorage.getItem("r2UploadToken") || "";
        show("#ov-settings");
    });
    $("#set-save").addEventListener("click", () => {
        localStorage.setItem("r2WorkerUrl", $("#set-url").value.trim());
        localStorage.setItem("r2UploadToken", $("#set-token").value.trim());
        hideAll();
        toast("Settings saved.");
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            editingNode = null;
            hideAll();
        }
    });

    /* ============================================================
       HTML cleaning / serialization
       ============================================================ */
    const ALLOWED = {
        H2: [], H3: [], H4: [], P: [], BLOCKQUOTE: [],
        UL: [], OL: [], LI: [],
        A: ["href", "class"], STRONG: [], EM: [], BR: [], HR: [],
        FIGURE: [], IMG: ["src", "alt"], FIGCAPTION: [], SPAN: ["class"],
    };
    const TAG_MAP = { B: "STRONG", I: "EM", DIV: "P" };
    const VOID = new Set(["BR", "HR", "IMG"]);
    const DROP_IF_EMPTY = new Set(["STRONG", "EM", "A", "SPAN", "P", "FIGCAPTION", "H2", "H3", "H4", "BLOCKQUOTE"]);

    function esc(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function childrenHtml(node) {
        let s = "";
        node.childNodes.forEach((n) => (s += nodeHtml(n)));
        return s;
    }

    function nodeHtml(node) {
        if (node.nodeType === 3) return esc(node.nodeValue);
        if (node.nodeType !== 1) return "";

        let tag = node.tagName;
        if (tag in TAG_MAP) tag = TAG_MAP[tag];

        // SPAN: keep only the go-deeper label, otherwise unwrap
        if (node.tagName === "SPAN") {
            if ((node.getAttribute("class") || "").includes("adt-go-deeper-label")) {
                return '<span class="adt-go-deeper-label">' + childrenHtml(node) + "</span>";
            }
            return childrenHtml(node);
        }

        // Unknown / disallowed tag → unwrap, keep its children
        if (!(tag in ALLOWED)) return childrenHtml(node);

        // Attributes
        let attrs = "";
        for (const a of ALLOWED[tag]) {
            let v = node.getAttribute(a);
            if (a === "class") {
                v =
                    node.tagName === "A" && (v || "").includes("adt-go-deeper")
                        ? "adt-go-deeper"
                        : null;
            }
            if (v != null && v !== "") attrs += " " + a + '="' + esc(v) + '"';
        }

        const lower = tag.toLowerCase();
        if (VOID.has(tag)) return "<" + lower + attrs + ">";

        const inner = childrenHtml(node);
        if (!inner.trim() && DROP_IF_EMPTY.has(tag)) return "";
        return "<" + lower + attrs + ">" + inner + "</" + lower + ">";
    }

    function getCleanHTML() {
        const out = [];
        editor.childNodes.forEach((n) => {
            const h = nodeHtml(n).trim();
            if (h) out.push(h);
        });
        return out.join("\n");
    }

    /* ============================================================
       Toggle visual <-> HTML source
       ============================================================ */
    let htmlMode = false;
    btnToggle.addEventListener("click", () => {
        htmlMode = !htmlMode;
        if (htmlMode) {
            raw.value = getCleanHTML();
            editor.hidden = true;
            raw.hidden = false;
            btnToggle.classList.add("active");
        } else {
            editor.innerHTML = raw.value;
            normalize();
            editor.hidden = false;
            raw.hidden = true;
            btnToggle.classList.remove("active");
        }
    });

    /* ============================================================
       Copy HTML for Framer
       ============================================================ */
    $("#btn-copy").addEventListener("click", async () => {
        const html = htmlMode ? raw.value : getCleanHTML();
        try {
            await navigator.clipboard.writeText(html);
            toast("HTML copied — paste into the Framer body field.");
        } catch (e) {
            // Fallback for older browsers
            const ta = document.createElement("textarea");
            ta.value = html;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            toast("HTML copied.");
        }
    });

    /* ---------- Toast ---------- */
    let toastTimer = null;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => (toastEl.hidden = true), 2600);
    }
})();
