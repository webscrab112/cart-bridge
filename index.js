const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/**
 * HEALTH CHECK
 * Railway uses this to verify app is alive
 */
app.get("/", (req, res) => {
  res.send("Cart bridge is running");
});

/**
 * YOUR PRODUCT MAP
 * WooCommerce ID -> Shopify Variant ID
 */
const productMap = {
  6191: "53755196703057",
  5786: "53755775385937",
  6480: "53755808219473"
};

/**
 * CONVERT CART
 */
app.post("/convert-cart", (req, res) => {
  try {
    const cart = req.body.cart || [];

    const parts = cart
      .map(item => {
        const shopifyId = productMap[item.id];
        if (!shopifyId) return null;
        return `${shopifyId}:${item.qty}`;
      })
      .filter(Boolean);

    const url =
      "https://qesbbu-2v.myshopify.com/cart/" +
      parts.join(",");

    res.json({ url });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * IMPORTANT: RAILWAY PORT BINDING
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
