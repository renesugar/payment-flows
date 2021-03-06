const express = require("express");
const app = express();
const { resolve } = require("path");
const envPath = resolve(".env");
const env = require("dotenv").config({ path: envPath });

const stripe = require("stripe")(env.parsed.STRIPE_SECRET_KEY);

app.use(express.static("./client"));

// Grants access to the raw request body to use for webhook signing
// Learn more https://stripe.com/docs/webhooks/signatures
app.use(
  express.json({
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    }
  })
);

// Render the checkout page
app.get("/", function(request, response) {
  const path = resolve("./client/index.html");
  response.sendFile(path);
});

// Create a Checkout Session that is used to render the Stripe-hosted payment page
app.post("/create-session", async (req, res) => {
  // Line items will be displayed in the payment page
  // List of { quantity: 2, amount: 799, name: "Stripe pins", currency: "eur" }
  const { lineItems } = req.body;

  const session = await stripe.checkout.sessions.create(
    {
      success_url: `${env.parsed.DOMAIN}/success`,
      cancel_url: `${env.parsed.DOMAIN}/cancel`,
      payment_method_types: ["card"],
      line_items: lineItems,
      payment_intent_data: {
        capture_method: "manual"
      }
    },
    { stripe_version: "2018-11-08; checkout_sessions_beta=v1" }
  );
  res.send({ session: session.id });
});

// Stripe will redirect here if the payment succeeds
app.get("/success", async (req, res) => {
  const path = resolve("./client/success.html");
  res.sendFile(path);
});

// Stripe will redirect here if the user cancels
app.get("/cancel", async (req, res) => {
  // Handle user navigating away from your Checkout page
  const path = resolve("./client/error.html");
  res.sendFile(path);
});

app.post("/webhook", async (req, res) => {
  // Check if webhook signing is configured.
  if (env.parsed.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        env.parsed.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // we can retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === "checkout.session.completed") {
    console.log("💰Your user provided payment details!");
    // Fulfill any orders or e-mail receipts
    res.sendStatus(200);
  }
});

// Start server
const listener = app.listen(process.env.PORT || 3000, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
