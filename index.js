"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));

const PRODUCT_MAP = {
  5786: "54798574387541",
  6140: "54798526447957",
  6191: "54798526447957",
  6227: "54967262708053",
  6302: "54971331936597",
  6306: "54971319943509",
  6308: "54971331936597",
  6314: "54798573797717",
  6362: "54798574387541",
  6396: "54971331936597",
  6419: "54967262708053",
  6480: "54971336622421",
  6482: "54798574387541",
  6500: "54967262708053",
  6697: "54798574387541",
  6719: "54798526447957",
  6813: "54967259693397",
  6819: "54971189100885",
  6849: "54971336622421",
  7534: "54971319943509",
  7584: "54967255794005",
  7914: "54798563836245",
  8044: "54967138156885",
  8098: "54798564426069",
  8188: "54967255794005",
  8336: "54967262708053",
  8430: "54967138156885",
  8436: "54967138156885",
  8461: "54798562722133",
  8485: "54798562459989",
  8563: "54970048020821",
  3904: "54970048020821",
  6354: "54971336622421",
  3354: "54970048020821"
};

const SHOPIFY_STORE = "https://backtovault.shop";

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
