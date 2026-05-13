<script>

jQuery(document).on('click', '.checkout-button.wc-forward', function(e){

    e.preventDefault();

    alert("CLICK OK");

    fetch('https://cart-bridge-production.up.railway.app/convert-cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cart: [
                { id: 101, qty: 2 }
            ]
        })
    })
    .then(res => res.json())
    .then(data => {

        alert("RESPONSE: " + JSON.stringify(data));

        console.log(data);

    })
    .catch(err => {

        alert("ERROR: " + err);

    });

});

</script>
