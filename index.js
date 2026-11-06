"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.set("trust proxy", 1);
app.use(cors({ origin: ["https://returntovault.shop", "https://www.returntovault.shop"] }));
app.use(express.json({ limit: "10kb" }));

const PRODUCT_MAP = Object.freeze({
  6314: "58155992547708",
  8563: "58155987337596",
  8436: "58155989565820",
  8430: "58155989565820",
  8044: "58155989565820",
  8336: "58155964236156",
  7584: "58155987140988",
  6819: "58155992547708",
  6500: "58155989074300",
  6419: "58156019908988",
  6227: "58156019908988",
  6191: "58156019908988",
  6140: "58156019908988",
  5786: "58155964236156",
  6719: "58155989074300",
  6813: "58155989500284",
  6480: "58155987075452",
  6308: "58155991564668",
  6306: "58155991564668",
  6302: "58155979997564",
  7534: "58155987337596",
  6396: "58155984421244",
  6697: "58155964236156",
  6849: "58155987140988",
  6482: "58155964236156",
  6362: "58155964236156",
  3354: "58155992777084",
  6354: "58155986092412",
  8589: "58155992777084",
  8764: "58155985469820",
  6538: "58155989664124",
  7013: "58155992777084"
});

const VARIANT_ID_RE = /^\d{10,20}$/;
const MAX_QTY_PER_LINE = 99;
const MAX_LINES = 50;

const SHOPIFY_STORE = "https://returntovault.shop";

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Cart bridge running",
    products: Object.keys(PRODUCT_MAP).length
  });
});

app.post("/convert-cart", (req, res) => {
  try {
    const { cart } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        error: "cart must be a non-empty array",
        example: { cart: [{ id: 6191, qty: 2 }] }
      });
    }

    if (cart.length > MAX_LINES) {
      return res.status(400).json({ error: `Too many cart lines (max ${MAX_LINES}).` });
    }

    const variantTotals = Object.create(null);
    const skipped = [];

    for (const item of cart) {
      const id  = Number(item?.id);
      const qty = Math.floor(Number(item?.qty));

      if (!Number.isInteger(id) || id <= 0) {
        skipped.push({ id: item?.id, qty: item?.qty, reason: "invalid id" });
        continue;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        skipped.push({ id, qty: item?.qty, reason: "invalid qty" });
        continue;
      }
      if (qty > MAX_QTY_PER_LINE) {
        skipped.push({ id, qty, reason: `qty exceeds max ${MAX_QTY_PER_LINE}` });
        continue;
      }

      const variantId = PRODUCT_MAP[id];

      if (!variantId) {
        skipped.push({ id, qty, reason: `WooCommerce ID ${id} not in PRODUCT_MAP` });
        continue;
      }

      if (!VARIANT_ID_RE.test(variantId)) {
        skipped.push({ id, qty, reason: `Variant ID for ${id} is malformed` });
        continue;
      }

      variantTotals[variantId] = (variantTotals[variantId] || 0) + qty;
    }

    const parts = Object.keys(variantTotals)
      .map((v) => `${v}:${variantTotals[v]}`);

    if (parts.length === 0) {
      return res.status(400).json({
        error: "No products matched PRODUCT_MAP.",
        received_ids: cart.map((i) => i?.id),
        skipped
      });
    }

    const addPath = `/cart/${parts.join(",")}`;
    const url = `${SHOPIFY_STORE}/cart/clear?return_to=${encodeURIComponent(addPath)}`;

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
