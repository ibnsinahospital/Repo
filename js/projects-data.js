/* ==========================================================================
   Bhat Foundation Welfare Society — Projects & Reports Loader
   Reads rows from the published Projects Google Sheet.
   Supports both GitHub Pages URLs and Google Drive links.
   ========================================================================== */

const PROJECTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQE8hw5Bif58L-qzPb66-0uosS0nUUxKBniR8l6v7SlwWnp1ygFE1Y-AqxaHktvhq_XonSEqqpGxg__/pub?output=csv";

/* ---------- CSV parser ---------- */
function parseCSVProject(text) {
  var rows = [], row = [], field = "", inQuotes = false, i = 0;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  while (i < text.length) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function (r) {
    return r.some(function (c) { return String(c).trim() !== ""; });
  });
}

function normaliseHeader(h) {
  return String(h).trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function csvToObjectsProject(rows) {
  if (!rows.length) return [];
  var headers = rows[0].map(normaliseHeader);
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {}, hasContent = false;
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      if (!key) continue;
      var val = rows[i][j] === undefined ? "" : String(rows[i][j]).trim();
      obj[key] = val;
      if (val !== "") hasContent = true;
    }
    if (hasContent) out.push(obj);
  }
  return out;
}

/* ---------- Extract PDF reference ----------
   Returns:
     "url:https://..."  → direct URL (GitHub Pages)
     "drive:FILE_ID"    → Google Drive file ID
   -------------------------------------------- */
function extractDriveId(url) {
  if (!url) return "";
  url = String(url).trim();
  if (url.indexOf("PASTE_") === 0) return "";

  // GitHub Pages or any non-Drive http(s) URL
  if (url.indexOf("http") === 0 && url.indexOf("drive.google.com") === -1) {
    return "url:" + url;
  }

  // Drive link → extract file ID
  var m = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m) return "drive:" + m[1];

  m = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return "drive:" + m[1];

  // Bare file ID — assume Drive
  if (/^[A-Za-z0-9_-]{20,}$/.test(url)) return "drive:" + url;

  return "drive:" + url;
}

/* ---------- Loader ---------- */
function loadProjects() {
  if (!PROJECTS_CSV_URL || PROJECTS_CSV_URL.indexOf("PASTE_") === 0) {
    return Promise.resolve([]);
  }
  return fetch(PROJECTS_CSV_URL, { method: "GET", redirect: "follow", cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      return csvToObjectsProject(parseCSVProject(text))
        .filter(function (p) { return p.title && p.title.trim(); })
        .map(function (p) {
          var ord = Number(p.order);
          return {
            title: (p.title || "").trim(),
            date: (p.date || "").trim(),
            category: (p.category || "").trim(),
            summary: (p.summary || "").trim(),
            pdfId: extractDriveId((p.pdf_url || "").trim()),
            thumbnail: (p.thumbnail || "").trim(),
            order: isNaN(ord) ? 9999 : ord
          };
        })
        .sort(function (a, b) { return a.order - b.order; });
    })
    .catch(function (err) {
      console.warn("Projects CSV failed:", err);
      return [];
    });
}
