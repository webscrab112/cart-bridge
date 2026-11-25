"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));

const PRODUCT_MAP = {
  8098: "55611001897298",
  8485: "55611001110866",
  8461: "55611001012562",
  8188: "55611001274706",
  7914: "55611000947026",
  6314: "55611000947026",
  8563: "55611000947026",
  8436: "55611001995602",
  8430: "55611001995602",
  8044: "55611001995602",
  8336: "55611001209170",
  7584: "55568974119250",
  6819: "55611000947026",
  6500: "55568974086482",
  6419: "55611000652114",
  6227: "55611000652114",
  6191: "55611000652114",
  6140: "55611000652114",
  5786: "55611001209170",
  6719: "55611001209170",
  6813: "55611001373010",
  6480: "55611000848722",
  6308: "55611002028370",
  6306: "55611002028370",
  6302: "55611001995602",
  7534: "55568974119250",
  6396: "55568974119250",
  6697: "55611001209170",
  6849: "55568973955410",
  6482: "55611001209170",
  6362: "55611001209170",
  3354: "55568973955410",
  6354: "55568974250322",
  8589: "55568974250322",
  8764: "55611000848722",
  6538: "55611001110866",
  7013: "55568974250322",
  7323: "55568973955410",
  5188: "55568974086482",
  3833: "55611000947026",
  4974: "55568973955410",
  9760: "55568973955410"
};

const SHOPIFY_STORE = "https://backtovaultbuy.shop";

// ─────────────────────────────────────────────────────────────────────────────
// UTM attribution (optional + additive).
// The frontend MAY send the five UTM values in the /convert-cart JSON body,
// either as top-level keys or inside a `utm` object:
//   { cart: [...], utm: { utm_source: "...", ... } }
//   { cart: [...], utm_source: "...", utm_medium: "...", ... }
// Valid values are appended to the generated URL. Nothing is guessed, invented
// or detected from headers; invalid/empty values are silently ignored and can
// never make the cart conversion fail.
// ─────────────────────────────────────────────────────────────────────────────
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const UTM_MAX_LEN = 256;

function cleanUtmValue(v) {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!s || s.length > UTM_MAX_LEN) return null;
  // Classic frontend bug: a missing value stringified as "undefined"/"null".
  if (s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return null;
  // Malformed text (e.g. lone surrogate) would make encodeURIComponent throw.
  try { encodeURIComponent(s); } catch (_e) { return null; }
  return s;
}

// Returns { utm_source?: string, ... } with at most one valid value per key.
// Precedence: the nested `utm` object first, then top-level keys; the first
// valid value for a key wins and is never overwritten by a later one.
function extractUtm(body) {
  const out = {};
  if (!body || typeof body !== "object") return out;

  const sources = [];
  if (body.utm && typeof body.utm === "object" && !Array.isArray(body.utm)) {
    sources.push(body.utm);
  }
  sources.push(body);

  for (const src of sources) {
    for (const rawKey of Object.keys(src)) {
      const key = rawKey.trim().toLowerCase();
      if (!UTM_KEYS.includes(key)) continue;
      if (Object.prototype.hasOwnProperty.call(out, key)) continue;
      const val = cleanUtmValue(src[rawKey]);
      if (val !== null) out[key] = val;
    }
  }
  return out;
}

// Appends the UTMs after the existing query string, in a fixed order, once each.
function appendUtm(url, utm) {
  const pairs = UTM_KEYS
    .filter(function (k) { return Object.prototype.hasOwnProperty.call(utm, k); })
    .map(function (k) { return k + "=" + encodeURIComponent(utm[k]); });
  if (pairs.length === 0) return url;
  return url + (url.indexOf("?") === -1 ? "?" : "&") + pairs.join("&");
}

app.get("/", (_req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Cart bridge running", 
    products: Object.keys(PRODUCT_MAP).length 
  });
});

app.post("/convert-cart", (req, res) => {
  try {
    console.log("INCOMING:", JSON.stringify(req.body));

    const { cart } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        error: "cart must be a non-empty array",
        example: { cart: [{ id: 6191, qty: 2 }] }
      });
    }

    const variantTotals = {};
    const skipped = [];

    for (const item of cart) {
      const id  = Number(item.id);
      const qty = Math.floor(Number(item.qty));

      if (!id || id <= 0) { 
        skipped.push({ ...item, reason: "invalid id" }); 
        continue; 
      }
      if (!qty || qty <= 0) { 
        skipped.push({ ...item, reason: "invalid qty" }); 
        continue; 
      }

      const variantId = PRODUCT_MAP[id];
      console.log(`id=${id} qty=${qty} → ${variantId || "NOT IN MAP"}`);

      if (!variantId) {
        skipped.push({ id, qty, reason: `WooCommerce ID ${id} not in PRODUCT_MAP` });
        continue;
      }

      variantTotals[variantId] = (variantTotals[variantId] || 0) + qty;
    }

    const parts = Object.keys(variantTotals)
      .map(function (v) { return v + ":" + variantTotals[v]; });

    if (parts.length === 0) {
      return res.status(400).json({
        error: "No products matched PRODUCT_MAP.",
        received_ids: cart.map(i => i.id),
        map_has: Object.keys(PRODUCT_MAP).map(Number),
        skipped
      });
    }

    const addPath = `/cart/${parts.join(",")}`;
    const baseUrl = `${SHOPIFY_STORE}/cart/clear?return_to=${encodeURIComponent(addPath)}`;
    const utm = extractUtm(req.body);
    const url = appendUtm(baseUrl, utm);

    if (Object.keys(utm).length > 0) console.log("UTM:", JSON.stringify(utm));
    console.log("✅ URL:", url);

    return res.status(200).json({ url, skipped });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Cart bridge on port ${PORT}`);
  console.log(`Map: ${Object.keys(PRODUCT_MAP).length} WooCommerce IDs → Shopify (1-to-1)`);
});
