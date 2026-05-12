const express = require("express");
const app = express();

app.use(express.json());

const productMap = {
 6191: "53755196703057",
  5786: "53755775385937",
  6480: "53755808219473"
};

app.post("/convert-cart", (req, res) => {

  const cart = req.body.cart || [];

  let parts = cart.map(item => {
   return ${productMap[item.id]}:${item.qty};
  });

  const url =
    "https://qesbbu-2v.myshopify.com/cart/" + parts.join(",");

  res.json({ url });
});

app.listen(process.env.PORT || 3000);
