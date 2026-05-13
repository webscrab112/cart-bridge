const express = require("express");
const app = express();

app.use(express.json());

// WooCommerce Product ID → Shopify Variant ID
const productMap = {
  6191: "53755196703057",

  5786: "53755775385937",

  6480: "53755808219473"
};

app.post("/convert-cart", (req, res) => {

  const cart = req.body.cart || [];

  let parts = cart.map(item => {

    let shopifyId = productMap[item.id];

    if (!shopifyId) return null;

    return ${shopifyId}:${item.qty};

  }).filter(Boolean);

  const checkoutURL =
    "https://qesbbu-2v.myshopify.com/cart/" +
    parts.join(",");

  res.json({
    url: checkoutURL
  });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
