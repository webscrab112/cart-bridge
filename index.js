"use strict";

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));

/* ══════════════════════════════════════════════════════════════
   PRODUCT MAP
   WooCommerce product ID → Shopify variant ID

   Each Shopify product was created 1-to-1 with its WooCommerce
   counterpart, so every entry below is unique on both sides.
   No merge logic is needed — one WooCommerce ID always means
   exactly one Shopify variant, and vice versa.

   TO ADD A NEW PRODUCT:
   1. Create a matching product in Shopify (1-to-1, don't reuse
      an existing Shopify product/variant for a different
      WooCommerce product — this is what caused order mix-ups
      in the old multi-ID system).
   2. WooCommerce ID: wp-admin → Products → hover name → post=XXXX
   3. Shopify variant ID: Shopify admin → Products → variant →
      /variants/XXXX in the URL
   4. Add a line below: WOOCOMMERCE_ID: "SHOPIFY_VARIANT_ID",
══════════════════════════════════════════════════════════════ */
const PRODUCT_MAP = {
  6419: "53755196703057",
  6140: "54150524666193",
  6191: "54150526435665",
  5786: "53755775385937",
  6697: "54150527582545",
  6482: "54150527910225",
  6362: "54150541836625",
  6308: "53835905565009",
  6480: "53755808219473",
  6719: "53835877548369",
  6500: "54150533579089",
  6314: "53835896586577",
  6819: "54150533710161",
  6347: "54150540001617",
  6766: "53835898093905",
  6227: "53835869782353",
  6302: "53835903435089",
  6849: "53835901927761",
  6306: "54150542131537",
  7584: "10902157492561",
  7914: "54150542197073",
  7534: "54150532727121",
  6605: "54150533316945",
  6396: "54150532530513",
  7556: "54150674776401",
  6813: "54150674973009",
};

const SHOPIFY_STORE = "https://qesbbu-2v.myshopify.com";

app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Cart bridge running", products: Object.keys(PRODUCT_MAP).length });
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

    // Each WooCommerce ID maps to a UNIQUE Shopify variant now, so
    // we still accumulate by variant defensively (in case the same
    // product is somehow represented twice in one cart payload),
    // but in practice each line stays 1-to-1.
    const variantTotals = {};
    const skipped       = [];

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
  console.log(`Map: ${Object.keys(PRODUCT_MAP).length} WooCommerce IDs → Shopify (1-to-1)`);
});
