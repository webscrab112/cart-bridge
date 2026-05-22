"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));

/* ══════════════════════════════════════════════════════════════
   PRODUCT MAP
   Every WooCommerce product ID → its Shopify variant ID.
   Multiple WooCommerce IDs can map to the same Shopify variant.

   TO ADD A NEW PRODUCT:
   1. WooCommerce admin → Products → hover name → browser bar shows post=XXXX
   2. Shopify admin → Products → click variant → URL shows /variants/XXXXXXXXXX
   3. Add one line: WOOCOMMERCE_ID: "SHOPIFY_VARIANT_ID",
══════════════════════════════════════════════════════════════ */
const PRODUCT_MAP = {
  // Shopify variant 53755196703057
  6419: "53755196703057",
  6191: "53755196703057",
  6140: "53755196703057",

  // Shopify variant 53755775385937
  5786: "53755775385937",
  6697: "53755775385937",
  6482: "53755775385937",
  6362: "53755775385937",

  // Shopify variant 53835905565009
  6308: "53835905565009",

  // Shopify variant 53755808219473
  6480: "53755808219473",

  // Shopify variant 53835877548369
  6719: "53835877548369",
  6500: "53835877548369",

  // Shopify variant 53835896586577
  6314: "53835896586577",
  6347: "53835896586577",
  6819: "53835896586577",

  // Shopify variant 53835898093905
  6766: "53835898093905",

  // Shopify variant 53835869782353
  6227: "53835869782353",

  // Shopify variant 53835903435089
  6302: "53835903435089",

  // Shopify variant 53835901927761
  6849: "53835901927761",
  6306: "53835901927761",
};

const SHOPIFY_STORE = "https://qesbbu-2v.myshopify.com";

/* ── Health check ─────────────────────────────────────────── */
app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Cart bridge running" });
});

/* ══════════════════════════════════════════════════════════════
   POST /convert-cart
   Receives: { cart: [ { id: 6191, qty: 2 } ] }
   Returns:  { url: "https://shopify.../cart/VARIANT:QTY,..." }
══════════════════════════════════════════════════════════════ */
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

    // Merge quantities per Shopify variant
    // (multiple WooCommerce products can map to same Shopify variant)
    const variantQty = {};
    const skipped    = [];

    for (const item of cart) {
      const id  = Number(item.id);
      const qty = Math.floor(Number(item.qty));

      if (!id  || id  <= 0) { skipped.push({ ...item, reason: "invalid id"  }); continue; }
      if (!qty || qty <= 0) { skipped.push({ ...item, reason: "invalid qty" }); continue; }

      const variantId = PRODUCT_MAP[id];
      console.log(`id=${id} qty=${qty} → ${variantId || "NOT IN MAP"}`);

      if (!variantId) {
        skipped.push({ id, qty, reason: `WooCommerce ID ${id} not in PRODUCT_MAP` });
        continue;
      }

      variantQty[variantId] = (variantQty[variantId] || 0) + qty;
    }

    const parts = Object.keys(variantQty).map(v => `${v}:${variantQty[v]}`);

    if (parts.length === 0) {
      return res.status(400).json({
        error: "No products matched. Check WooCommerce IDs vs PRODUCT_MAP.",
        received: cart.map(i => i.id),
        map_has: Object.keys(PRODUCT_MAP).map(Number),
        skipped
      });
    }

    const url = `${SHOPIFY_STORE}/cart/${parts.join(",")}`;
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
  console.log(`Map has ${Object.keys(PRODUCT_MAP).length} WooCommerce IDs`);
});
