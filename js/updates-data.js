/* ==========================================================================
   Bhat Foundation Welfare Society — Gallery + Daily Updates Loader
   Fetches from two published Google Sheets (CSV format).
   Used by: index.html, updates.html
   ========================================================================== */

/* ---------- 1. Published CSV URLs ---------- */
const GALLERY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vST8P-rbbS2p43Om31Q9wG-JGxsRGd3lZmf5wYTq6LQbbUJOxtkW4sHIyNQC5tyKvUWhz5am80NwBsS/pub?output=csv";
const UPDATES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT3oKKIoMq_mUKqSYvZM4uGBp7ZPgKD3xhs3p1acPyH8tWijmurORJ8XiwtDU7xZv_X1_Vq9PyRxq0J/pub?output=csv";

/* ---------- 2. CSV parser ---------- */
function parseCSV(text) {
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

function csvToObjects(rows) {
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

function fetchCSV(url) {
  if (!url) return Promise.resolve([]);
  return fetch(url, { method: "GET", redirect: "follow", cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) { return csvToObjects(parseCSV(text)); });
}

/* ---------- 3. Loader ---------- */
function loadSiteContent() {
  var galleryPromise = fetchCSV(GALLERY_CSV_URL).catch(function (err) {
    console.warn("Gallery CSV failed:", err);
    return [];
  });
  var updatesPromise = fetchCSV(UPDATES_CSV_URL).catch(function (err) {
    console.warn("Updates CSV failed:", err);
    return [];
  });

  return Promise.all([galleryPromise, updatesPromise]).then(function (results) {
    var galleryRows = results[0] || [];
    var updateRows = results[1] || [];

    var gallery = galleryRows
      .filter(function (g) { return g.image && g.image.trim(); })
      .map(function (g) {
        var ord = Number(g.order);
        return {
          image: g.image.trim(),
          caption: (g.caption || "").trim(),
          order: isNaN(ord) ? 9999 : ord
        };
      })
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (g) { return { image: g.image, caption: g.caption }; });

    var updates = updateRows
      .filter(function (u) { return u.title && u.title.trim(); })
      .map(function (u) {
        return {
          date: (u.date || "").trim(),
          tag: (u.tag || "").trim(),
          title: (u.title || "").trim(),
          excerpt: (u.excerpt || "").trim()
        };
      });

    return { gallery: gallery, updates: updates };
  });
}
