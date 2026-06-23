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

    // Offset the page by the fixed toolbar's height (it can wrap to 2 rows)
    function syncTopPad() {
        document.body.style.paddingTop = toolbar.offsetHeight + "px";
    }
    syncTopPad();
    window.addEventListener("resize", syncTopPad);
    if (window.ResizeObserver) new ResizeObserver(syncTopPad).observe(toolbar);

    // Enter creates <p> instead of <div>
    try {
        document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {}

    /* ---------- Persistence (localStorage) ---------- */
    const STORAGE_KEY = "blogEditorContent";

    let htmlMode = false;
    let saveTimer = null;
    function currentHTML() {
        return htmlMode ? raw.value : getCleanHTML();
    }
    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, currentHTML());
        } catch (e) {}
    }
    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 400);
    }

    /* ---------- Initial content: saved draft, else starter ---------- */
    const STARTER = [
        "<h2>The visibility trap</h2>",
        "<p>Most tattoo artists who struggle with bookings don't have a talent problem. They have a <strong>visibility problem</strong> — or worse, a conversion problem they've misdiagnosed as a visibility problem.</p>",
        "<blockquote>Advertising amplifies what's already there.</blockquote>",
        "<ul><li><strong>Calendar empty:</strong> start with Google Search ads — the intent is already there.</li><li><strong>Strong content, low reach:</strong> run Meta awareness ads to a local audience.</li></ul>",
        '<a class="adt-go-deeper" href="/blog/meta-ads-for-tattoo-artists" contenteditable="false"><span class="adt-go-deeper-label">Go deeper</span>Meta Ads for Tattoo Artists: The Booking Framework</a>',
        "<p><br></p>",
    ].join("");

    let savedDraft = null;
    try {
        savedDraft = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    editor.innerHTML = savedDraft && savedDraft.trim() ? savedDraft : STARTER;
    normalize();

    // Save on every edit (typing in either view)
    editor.addEventListener("input", scheduleSave);
    raw.addEventListener("input", scheduleSave);

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
            setBlock(b.dataset.block);
        } else if (b.dataset.list) {
            editor.focus();
            document.execCommand(
                b.dataset.list === "ul" ? "insertUnorderedList" : "insertOrderedList"
            );
            scheduleSave();
        } else if (b.dataset.inline) {
            editor.focus();
            document.execCommand(b.dataset.inline);
            scheduleSave();
        }
    });

    $("#btn-link").addEventListener("click", () => {
        const url = prompt("Link URL:");
        if (!url) return;
        restoreSelection();
        document.execCommand("createLink", false, url);
        scheduleSave();
    });

    $("#btn-hr").addEventListener("click", () => {
        restoreSelection();
        document.execCommand("insertHorizontalRule");
        scheduleSave();
    });

    $("#btn-clear").addEventListener("click", clearFormatting);

    /* ============================================================
       Block formatting — replace the block's tag (never nest)
       ============================================================ */
    function topLevelBlocksInRange(range) {
        const blocks = [];
        editor.childNodes.forEach((node) => {
            if (node.nodeType === 1 && range.intersectsNode(node)) blocks.push(node);
        });
        return blocks;
    }

    function convertBlock(block, tag) {
        // Never touch structural blocks
        if (
            block.tagName === "FIGURE" ||
            block.tagName === "UL" ||
            block.tagName === "OL" ||
            block.tagName === "HR" ||
            block.classList.contains("adt-go-deeper")
        ) {
            return block;
        }
        const el = document.createElement(tag);
        while (block.firstChild) el.appendChild(block.firstChild);
        if (!el.firstChild) el.appendChild(document.createElement("br"));
        block.replaceWith(el);
        return el;
    }

    function setBlock(tag) {
        editor.focus();
        restoreSelection();
        const sel = window.getSelection();
        if (!sel.rangeCount) {
            document.execCommand("formatBlock", false, tag);
            scheduleSave();
            return;
        }
        const range = sel.getRangeAt(0);
        const blocks = topLevelBlocksInRange(range);
        if (blocks.length === 0) {
            // Caret sits in a bare text node — let the browser wrap it
            document.execCommand("formatBlock", false, tag);
            scheduleSave();
            return;
        }
        const converted = blocks.map((b) => convertBlock(b, tag));
        const first = converted[0];
        const last = converted[converted.length - 1];
        const r = document.createRange();
        r.setStart(first, 0);
        r.setEnd(last, last.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(r);
        savedRange = r.cloneRange();
        scheduleSave();
    }

    // Clear formatting: strip styles, links and lists → plain paragraphs.
    // Leaves structural blocks (images, go-deeper, dividers) untouched.
    function clearFormatting() {
        editor.focus();
        restoreSelection();
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const blocks = topLevelBlocksInRange(sel.getRangeAt(0));
        if (blocks.length === 0) {
            document.execCommand("removeFormat");
            document.execCommand("unlink");
            document.execCommand("formatBlock", false, "p");
            scheduleSave();
            return;
        }
        const newPs = [];
        const toPlainP = (text) => {
            const p = document.createElement("p");
            if (text.trim()) p.textContent = text.trim();
            else p.innerHTML = "<br>";
            return p;
        };
        blocks.forEach((block) => {
            // Don't flatten images, go-deeper buttons or dividers
            if (
                block.tagName === "FIGURE" ||
                block.tagName === "HR" ||
                block.classList.contains("adt-go-deeper")
            ) {
                return;
            }
            if (block.tagName === "UL" || block.tagName === "OL") {
                const frag = document.createDocumentFragment();
                Array.from(block.children)
                    .filter((c) => c.tagName === "LI")
                    .forEach((li) => {
                        const p = toPlainP(li.textContent);
                        frag.appendChild(p);
                        newPs.push(p);
                    });
                if (frag.childNodes.length) block.replaceWith(frag);
                else block.remove();
            } else {
                const p = toPlainP(block.textContent);
                block.replaceWith(p);
                newPs.push(p);
            }
        });
        if (newPs.length) {
            const r = document.createRange();
            r.setStart(newPs[0], 0);
            const last = newPs[newPs.length - 1];
            r.setEnd(last, last.childNodes.length);
            sel.removeAllRanges();
            sel.addRange(r);
            savedRange = r.cloneRange();
        }
        scheduleSave();
    }

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
            scheduleSave();
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
        scheduleSave();
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

    function buildFigure(src, alt, caption, widthPct, aspect) {
        const fig = document.createElement("figure");
        fig.setAttribute("contenteditable", "false");
        // Inline !important so it overrides the Framer .adt-prose stylesheet
        if (widthPct && widthPct < 100) {
            fig.style.cssText = "width:" + widthPct + "% !important;margin:0 auto !important";
        }
        const img = document.createElement("img");
        img.src = src;
        img.alt = alt || "";
        // Crop via aspect-ratio (not fixed px) so the shape scales with the
        // column width and stays identical on desktop, tablet and mobile.
        if (aspect) {
            img.style.cssText = "aspect-ratio:" + aspect + " !important;object-fit:cover !important";
        }
        fig.appendChild(img);
        if (caption) {
            const fc = document.createElement("figcaption");
            fc.textContent = caption;
            fig.appendChild(fc);
        }
        return fig;
    }

    // ── Video block (cases-page design) ──
    const PLAY_SVG =
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

    function buildVideoFigure(url) {
        const fig = document.createElement("figure");
        fig.className = "adt-video";
        fig.setAttribute("contenteditable", "false");
        const v = document.createElement("video");
        v.src = url;
        v.preload = "metadata";
        v.setAttribute("playsinline", "");
        fig.appendChild(v);
        decorateVideo(fig);
        return fig;
    }

    // Inject the play button / badges overlay and wire preview playback
    function decorateVideo(fig) {
        const v = fig.querySelector("video");
        if (!v || fig.querySelector(".adt-video-play")) return;

        const shade = document.createElement("span");
        shade.className = "adt-video-shade";
        shade.setAttribute("aria-hidden", "true");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "adt-video-play";
        btn.setAttribute("aria-label", "Play video");
        btn.innerHTML = PLAY_SVG;

        const badge = document.createElement("span");
        badge.className = "adt-video-badge";
        badge.innerHTML = '<span class="adt-video-dot"></span>Video';

        const hd = document.createElement("span");
        hd.className = "adt-video-hd";
        hd.textContent = "HD";

        fig.append(shade, btn, badge, hd);

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            v.controls = true;
            v.play();
            fig.classList.add("is-playing");
        });
        v.addEventListener("play", () => fig.classList.add("is-playing"));
        v.addEventListener("loadedmetadata", () => {
            const d = v.duration;
            if (d && isFinite(d)) {
                const m = Math.floor(d / 60);
                const s = Math.floor(d % 60);
                badge.innerHTML =
                    '<span class="adt-video-dot"></span>Video · ' +
                    String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
            }
        });
    }

    function normalize() {
        // Lock structural blocks so their internals can't be mangled
        editor
            .querySelectorAll(".adt-go-deeper, figure")
            .forEach((el) => el.setAttribute("contenteditable", "false"));
        // Rebuild video overlays for figures loaded from saved/raw HTML
        editor.querySelectorAll("figure.adt-video").forEach(decorateVideo);
    }

    // Single-click a go-deeper button to edit it (never follow the link)
    editor.addEventListener("click", (e) => {
        const gd = e.target.closest(".adt-go-deeper");
        if (!gd) return;
        e.preventDefault();
        editingNode = gd;
        openGoDeeper({
            url: gd.getAttribute("href") || "",
            title: (gd.lastChild && gd.lastChild.textContent) || "",
        });
    });

    // Double-click a figure to edit it (image or video)
    editor.addEventListener("dblclick", (e) => {
        const fig = e.target.closest("figure");
        if (!fig) return;
        editingNode = fig;
        if (fig.classList.contains("adt-video")) {
            const v = fig.querySelector("video");
            openVideo({ url: (v && v.getAttribute("src")) || "" });
            return;
        }
        const img = fig.querySelector("img");
        const cap = fig.querySelector("figcaption");
        openImage({
            url: (img && img.getAttribute("src")) || "",
            alt: (img && img.getAttribute("alt")) || "",
            caption: (cap && cap.textContent) || "",
            width: parseInt(fig.style.width, 10) || 100,
            aspect: (img && parseFloat(img.style.aspectRatio)) || 0,
        });
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
    const gdDelete = $("#gd-delete");
    function openGoDeeper(data) {
        $("#gd-url").value = (data && data.url) || "";
        $("#gd-title").value = (data && data.title) || "";
        gdDelete.hidden = !editingNode; // only when editing an existing button
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
    gdDelete.addEventListener("click", () => {
        if (editingNode) {
            editingNode.remove();
            editingNode = null;
            scheduleSave();
        }
        hideAll();
    });

    /* ----- Image modal ----- */
    const imgUrl = $("#img-url");
    const imgInsert = $("#img-insert");
    const imgStatus = $("#img-status");
    const imgAlt = $("#img-alt");
    const imgCaption = $("#img-caption");
    const imgAdjust = $("#img-adjust");
    const imgPreview = $("#img-preview");
    const wRange = $("#w-range");
    const wVal = $("#w-val");
    const cropChk = $("#crop-on");
    const hRange = $("#h-range");
    const hVal = $("#h-val");
    const imgDelete = $("#img-delete");

    function currentCrop() {
        // slider value is ratio×100 → return the aspect ratio (w/h), or 0 = no crop
        return cropChk.checked ? parseInt(hRange.value, 10) / 100 : 0;
    }

    function updatePreview() {
        wVal.textContent = wRange.value + "%";
        hRange.disabled = !cropChk.checked;
        hVal.textContent = cropChk.checked
            ? (parseInt(hRange.value, 10) / 100).toFixed(2) + " : 1"
            : "—";

        const url = imgUrl.value.trim();
        imgAdjust.hidden = !url;
        if (!url) {
            imgPreview.innerHTML = "";
            return;
        }
        const fig = buildFigure(
            url,
            imgAlt.value.trim(),
            imgCaption.value.trim(),
            parseInt(wRange.value, 10),
            currentCrop()
        );
        fig.removeAttribute("contenteditable");
        imgPreview.innerHTML = "";
        imgPreview.appendChild(fig);
    }

    function openImage(data) {
        imgUrl.value = (data && data.url) || "";
        imgAlt.value = (data && data.alt) || "";
        imgCaption.value = (data && data.caption) || "";
        wRange.value = (data && data.width) || 100;
        const aspect = (data && data.aspect) || 0;
        cropChk.checked = !!aspect;
        hRange.value = aspect ? Math.round(aspect * 100) : 150;
        imgDelete.hidden = !editingNode; // only when editing an existing image
        imgStatus.textContent = "Uploads to your R2 bucket via the Worker.";
        imgStatus.classList.remove("error");
        refreshImgInsert();
        updatePreview();
        show("#ov-image");
    }
    $("#btn-image").addEventListener("click", () => {
        editingNode = null;
        openImage();
    });

    function refreshImgInsert() {
        imgInsert.disabled = !imgUrl.value.trim();
    }

    imgUrl.addEventListener("input", () => {
        refreshImgInsert();
        updatePreview();
    });
    imgAlt.addEventListener("input", updatePreview);
    imgCaption.addEventListener("input", updatePreview);
    wRange.addEventListener("input", updatePreview);
    hRange.addEventListener("input", updatePreview);
    cropChk.addEventListener("change", updatePreview);

    imgInsert.addEventListener("click", () => {
        const url = imgUrl.value.trim();
        if (!url) return;
        insertBlockNode(
            buildFigure(
                url,
                imgAlt.value.trim(),
                imgCaption.value.trim(),
                parseInt(wRange.value, 10),
                currentCrop()
            )
        );
        hideAll();
    });
    imgDelete.addEventListener("click", () => {
        if (editingNode) {
            editingNode.remove();
            editingNode = null;
            scheduleSave();
        }
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

    // ── Media library (localStorage) + shared uploader ──
    const LIB_KEY = "blogMediaLibrary";
    function isVideoUrl(u) {
        return /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(u || "");
    }
    function addToLibrary(url, type) {
        try {
            const lib = JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
            if (!lib.some((it) => it.url === url)) {
                lib.unshift({ url, type });
                localStorage.setItem(LIB_KEY, JSON.stringify(lib.slice(0, 200)));
            }
        } catch (e) {}
    }
    async function uploadToWorker(file) {
        const workerUrl = localStorage.getItem("r2WorkerUrl");
        if (!workerUrl) throw new Error("NO_WORKER");
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
        return data.url;
    }

    async function handleUpload(file) {
        try {
            imgStatus.classList.remove("error");
            imgStatus.textContent = "Uploading " + file.name + "…";
            const url = await uploadToWorker(file);
            addToLibrary(url, "image");
            imgUrl.value = url;
            refreshImgInsert();
            updatePreview();
            imgStatus.textContent = "Uploaded ✓";
        } catch (err) {
            imgStatus.classList.add("error");
            imgStatus.textContent =
                err.message === "NO_WORKER"
                    ? "No Worker URL set — open ⚙ Settings, or paste an image URL below."
                    : "Upload failed: " + err.message;
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

    /* ----- Video modal ----- */
    const vidUrl = $("#vid-url");
    const vidInsert = $("#vid-insert");
    const vidStatus = $("#vid-status");
    const vidPreview = $("#vid-preview");
    const vidDelete = $("#vid-delete");

    function updateVidPreview() {
        const url = vidUrl.value.trim();
        vidInsert.disabled = !url;
        vidPreview.innerHTML = "";
        if (url) {
            const fig = buildVideoFigure(url);
            fig.removeAttribute("contenteditable");
            vidPreview.appendChild(fig);
        }
    }

    function openVideo(data) {
        vidUrl.value = (data && data.url) || "";
        vidDelete.hidden = !editingNode;
        vidStatus.textContent = "Uploads to your R2 bucket via the Worker.";
        vidStatus.classList.remove("error");
        updateVidPreview();
        show("#ov-video");
    }
    $("#btn-video").addEventListener("click", () => {
        editingNode = null;
        openVideo();
    });
    vidUrl.addEventListener("input", updateVidPreview);
    vidInsert.addEventListener("click", () => {
        const url = vidUrl.value.trim();
        if (!url) return;
        insertBlockNode(buildVideoFigure(url));
        hideAll();
    });
    vidDelete.addEventListener("click", () => {
        if (editingNode) {
            editingNode.remove();
            editingNode = null;
            scheduleSave();
        }
        hideAll();
    });

    async function handleVideoUpload(file) {
        try {
            vidStatus.classList.remove("error");
            vidStatus.textContent = "Uploading " + file.name + "…";
            const url = await uploadToWorker(file);
            addToLibrary(url, "video");
            vidUrl.value = url;
            updateVidPreview();
            vidStatus.textContent = "Uploaded ✓";
        } catch (err) {
            vidStatus.classList.add("error");
            vidStatus.textContent =
                err.message === "NO_WORKER"
                    ? "No Worker URL set — open ⚙ Settings, or paste a video URL below."
                    : "Upload failed: " + err.message;
        }
    }

    const vidDrop = $("#vid-drop");
    const vidFile = $("#vid-file");
    vidDrop.addEventListener("click", () => vidFile.click());
    vidFile.addEventListener("change", () => {
        if (vidFile.files[0]) handleVideoUpload(vidFile.files[0]);
    });
    ["dragenter", "dragover"].forEach((ev) =>
        vidDrop.addEventListener(ev, (e) => { e.preventDefault(); vidDrop.classList.add("drag"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
        vidDrop.addEventListener(ev, (e) => { e.preventDefault(); vidDrop.classList.remove("drag"); })
    );
    vidDrop.addEventListener("drop", (e) => {
        const f = e.dataTransfer.files[0];
        if (f) handleVideoUpload(f);
    });

    /* ----- Gallery modal ----- */
    const galleryGrid = $("#gallery-grid");
    const galleryNote = $("#gallery-note");

    function insertMedia(url) {
        hideAll();
        editingNode = null;
        if (isVideoUrl(url)) insertBlockNode(buildVideoFigure(url));
        else insertBlockNode(buildFigure(url, "", "", 100, 0));
    }

    function renderGallery(items) {
        galleryGrid.innerHTML = "";
        if (!items.length) {
            const empty = document.createElement("div");
            empty.className = "gallery-empty";
            empty.textContent = "Nothing here yet — uploaded photos and videos will appear here.";
            galleryGrid.appendChild(empty);
            return;
        }
        items.forEach((it) => {
            const url = it.url;
            const video = it.type ? it.type === "video" : isVideoUrl(url);
            const cell = document.createElement("div");
            cell.className = "gallery-item";
            cell.title = url;
            if (video) {
                const v = document.createElement("video");
                v.src = url;
                v.preload = "metadata";
                v.muted = true;
                cell.appendChild(v);
                const play = document.createElement("span");
                play.className = "gallery-play";
                play.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
                cell.appendChild(play);
            } else {
                const img = document.createElement("img");
                img.src = url;
                img.loading = "lazy";
                cell.appendChild(img);
            }
            const tag = document.createElement("span");
            tag.className = "gallery-type";
            tag.textContent = video ? "Video" : "Photo";
            cell.appendChild(tag);
            cell.addEventListener("click", () => insertMedia(url));
            galleryGrid.appendChild(cell);
        });
    }

    async function openGallery() {
        editingNode = null;
        show("#ov-gallery");
        galleryNote.textContent = "Loading…";
        galleryGrid.innerHTML = "";

        let items = [];
        let source = "";
        const workerUrl = localStorage.getItem("r2WorkerUrl");
        // 1) Try the bucket listing via the Worker
        if (workerUrl) {
            try {
                const token = localStorage.getItem("r2UploadToken") || "";
                const res = await fetch(workerUrl, {
                    method: "GET",
                    headers: token ? { Authorization: "Bearer " + token } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    items = (data.items || []).filter((it) =>
                        /\.(jpg|jpeg|png|gif|webp|avif|svg|mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(it.url)
                    );
                    source = "bucket";
                }
            } catch (e) {}
        }
        // 2) Fall back to the local library
        if (items.length === 0) {
            try {
                items = JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
            } catch (e) { items = []; }
            source = "local";
        }
        galleryNote.textContent =
            items.length === 0
                ? "Click an item to insert it at the cursor."
                : `Click an item to insert it · ${items.length} from ${source === "bucket" ? "your R2 bucket" : "this browser"}`;
        renderGallery(items);
    }
    $("#btn-gallery").addEventListener("click", openGallery);

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
        FIGURE: ["style"], IMG: ["src", "alt", "style"], FIGCAPTION: [], SPAN: ["class"],
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

        // Video block → emit a minimal figure; the overlay is rebuilt on render
        if (node.tagName === "FIGURE" && node.classList && node.classList.contains("adt-video")) {
            const v = node.querySelector("video");
            const src = v ? v.getAttribute("src") : "";
            if (!src) return "";
            return '<figure class="adt-video"><video src="' + esc(src) + '" preload="metadata" playsinline></video></figure>';
        }

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
    btnToggle.addEventListener("click", () => {
        htmlMode = !htmlMode;
        if (htmlMode) {
            raw.value = getCleanHTML();
            editor.hidden = true;
            raw.hidden = false;
            btnToggle.classList.add("active");
            // Scroll the code view into view from its top
            raw.scrollIntoView({ behavior: "smooth", block: "start" });
            raw.focus();
        } else {
            editor.innerHTML = raw.value;
            normalize();
            editor.hidden = false;
            raw.hidden = true;
            btnToggle.classList.remove("active");
            editor.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        save();
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
