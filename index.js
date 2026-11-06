"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));

const PRODUCT_MAP = {
  8098: "58155987435900",
  8485: "58155989664124",
  8461: "58155992777084",
  8188: "58155987140988",
  7914: "58155987075452",
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
};

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
    const url = `${SHOPIFY_STORE}/cart/clear?return_to=${encodeURIComponent(addPath)}`;

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
