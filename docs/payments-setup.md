# Turning on payments

The site can take payment four ways. Each one switches on by itself once its keys are in Vercel, so you can set them up one at a time. Start in **test mode** (no real money), try a few orders, and only then switch to live keys.

| Customers see | What runs it | What it covers |
| --- | --- | --- |
| Card, Apple Pay or Google Pay | Stripe | Visa, Mastercard, Amex, Discover, Apple Pay, Google Pay, Cash App Pay, Link, bank transfer (ACH), and Klarna or Afterpay on one-time payments |
| PayPal or Venmo | PayPal | PayPal balance, bank or card, Pay Later, and Venmo on phones in the US |
| Zelle | You | Customers send it from their bank app; you mark the order paid in Admin |

Plans renew on their own with Stripe and PayPal (monthly, or yearly when the customer picks yearly). Zelle can't repeat, so those customers need a reminder each month.

All settings below go in **Vercel > your project > Settings > Environment Variables**. After adding or changing any of them, open **Deployments**, click the **⋯** on the newest one, and choose **Redeploy**.

## 1. Keep orders (do this first)

Right now orders are saved somewhere Vercel wipes, so a paid order could vanish from Admin.

1. In Vercel, open your project and click **Storage**.
2. Click **Create Database**, choose **Upstash for Redis**, pick the free plan, and create it.
3. When asked, connect it to the **think-web-pros** project (all environments). Vercel adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` settings for you.
4. Redeploy.

## 2. Admin password

Add `ADMIN_TOKEN` with a long password only you know (if it isn't already there). You type it into **Admin > Orders > Payments** to see real orders, mark Zelle payments paid, and price custom quotes.

## 3. Stripe (cards, Apple Pay, Google Pay, Cash App Pay and more)

1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register). You can test before finishing the business details.
2. Make sure **Test mode** (the toggle at the top) is on.
3. Go to **Developers > API keys** and copy the **Secret key** (starts with `sk_test_`). Add it in Vercel as `STRIPE_SECRET_KEY`.
4. Go to **Developers > Webhooks**, click **Add destination** (or **Add endpoint**), and enter:
   - Endpoint URL: `https://think-web-pros.vercel.app/api/stripe/webhook` (use your own domain once it's connected)
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
5. Open the webhook you just made, click **Reveal** under **Signing secret** (starts with `whsec_`), and add it in Vercel as `STRIPE_WEBHOOK_SECRET`.
6. Go to **Settings > Payments > Payment methods** and turn on **Apple Pay, Google Pay, Link, Cash App Pay, ACH Direct Debit, Klarna** and **Afterpay**. Stripe only shows each one where it fits (for example, Klarna and Afterpay don't appear on monthly plans).
7. Redeploy, then place an order with card `4242 4242 4242 4242`, any future date, any CVC and any ZIP.

To go live: finish **Activate payments** in Stripe, switch Test mode off, repeat steps 3 to 5 with the live keys (`sk_live_…` and the live webhook's `whsec_…`), and redeploy.

## 4. PayPal and Venmo

1. You need a **PayPal Business** account (free at [paypal.com/business](https://www.paypal.com/business)).
2. Sign in at [developer.paypal.com](https://developer.paypal.com) with that account and open **Apps & Credentials**.
3. With **Sandbox** selected, click **Create App**, name it Think Web Pros, and create it.
4. Copy the **Client ID** into Vercel as `PAYPAL_CLIENT_ID` and the **Secret** as `PAYPAL_CLIENT_SECRET`. Add `PAYPAL_ENV` = `sandbox`.
5. Redeploy and pay a test order with one of the sandbox **personal** accounts listed under **Testing Tools > Sandbox Accounts**.

To go live: switch to **Live** in Apps & Credentials, create the app there, replace the two keys with the live ones, set `PAYPAL_ENV` to `live`, and redeploy. Venmo shows up automatically for US customers on devices where they have Venmo.

## 5. Zelle

1. Use the email or US phone number your business bank account has enrolled in Zelle.
2. Add it in Vercel as `ZELLE_RECIPIENT`, and add `ZELLE_NAME` with the name customers will see in their bank app (for example, Think Web Pros LLC).
3. Redeploy.

When a customer picks Zelle they see the amount, where to send it, and their order number to put in the memo. When the money shows up in your bank, open **Admin > Orders > Payments** and click **Mark paid**.

## Custom quotes

Quote requests appear in **Admin > Orders > Payments** as **Needs a price**. Type the design fee and, if there is one, the monthly price, and click **Set price**. The pay link is copied for you; paste it into an email to the customer. The same **Copy pay link** button works for any unpaid order, such as a customer whose card was declined.

## Prices

What customers are charged comes from `server/catalog.js`, not from **Admin > Plans & pricing** (that page only changes what the Studio shows, in your browser). If you change a price, ask for both to be updated.

## Fees (check each company's site for current rates)

- Stripe: about 2.9% + 30¢ per US card payment; ACH, Klarna, Afterpay and Cash App Pay have their own rates.
- PayPal and Venmo: about 3.5% + 49¢ per payment.
- Zelle: no fee from Zelle; ask your bank about business account limits.
