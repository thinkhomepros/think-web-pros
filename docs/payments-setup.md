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

## 6. Card payments for your customers' shops (Stripe Connect)

Sections 3 to 5 are how **your** customers pay **you** for plans. This section lets the shops you build take cards from **their** shoppers. Each shop connects its own Stripe account, so shoppers' money goes straight to the shop's bank, never through yours. Uses the same `STRIPE_SECRET_KEY` from section 3.

1. In Stripe (test mode on), open **Connect** from the left menu (or search "Connect") and click **Get started**. When asked how you'll use Connect, pick the option for a **platform** whose users have their **own Stripe accounts** (Standard accounts). Fill in the **Platform profile** Stripe asks for.
2. Go to **Developers > Webhooks**, click **Add destination** (or **Add endpoint**), and choose **Events on Connected accounts** (not "Your account"). Enter:
   - Endpoint URL: `https://think-web-pros.vercel.app/api/stripe/connect-webhook`
   - Events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `account.updated`
3. Open that webhook, click **Reveal** under **Signing secret**, and add it in Vercel as `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. Optional: add `SHOP_FEE_PERCENT` (for example `1` for 1%) to take a cut of each shop sale for Think Web Pros. Left out, you take nothing; Stripe's own fee is paid by the shop.
5. Redeploy.

Then a shop owner signs in to the Studio, opens their name in the main menu, and clicks **Set up card payments**. Stripe walks them through it (about 5 minutes). Once Stripe says yes, their site offers card, Apple Pay and Google Pay at checkout. In test mode, use card `4242 4242 4242 4242`.

A shopper's unpaid card checkout holds the stock for 30 minutes, then the order is cancelled and the items go back on the shelf.

## 7. Receipts, order alerts and password resets (email and texts)

Shoppers get a receipt and a note when their order is ready, out for delivery, shipped or cancelled. Shop owners get an email for each new order (they can turn it off), and "Forgot your password?" works. All of it is off until these are set.

**Email (Resend, free for 3,000 emails a month):**
1. Sign up at [resend.com](https://resend.com).
2. Go to **Domains > Add Domain** and add the domain you send from (for example `thinkwebpros.com`). Resend shows a few DNS records; add them where your domain is managed and wait until Resend says **Verified**.
3. Go to **API Keys > Create API Key** (Sending access), copy it, and add it in Vercel as `RESEND_API_KEY`.
4. Add `EMAIL_FROM`, for example `Think Web Pros <orders@thinkwebpros.com>` (it must use the verified domain). Replies go to the shop owner's email automatically.
5. Redeploy.

**Texts (Twilio, optional):** shoppers who give a phone number get a text when their order is ready, and owners can have new orders texted to them (set in their account panel).
1. Sign up at [twilio.com](https://www.twilio.com), buy a US phone number, and finish **A2P 10DLC** registration for it (US carriers block texts from unregistered numbers; approval takes a few days).
2. From the Twilio console home, copy the **Account SID** and **Auth Token** into Vercel as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, and add the number as `TWILIO_FROM` (like `+12075550142`).
3. Redeploy.

## 8. Sales tax

Each shop owner sets their own sales tax rate in their account panel (**Orders and tax**). It's added to goods (not delivery or shipping) at checkout and shows on receipts. Owners should use their city and state's combined rate, and file and pay the tax themselves.

## 9. Shipping labels (Shippo)

Shop owners buy postage from the order screen (**Store › Orders › Ship**): they check the address, the box size and weight, pick the cheapest rate, and print a 4×6 label. The order is marked shipped and the shopper gets the tracking link by email.

Each owner uses **their own Shippo account**, so postage is charged to them, not to Think Web Pros. What an owner does:

1. Sign up free at [goshippo.com](https://goshippo.com) and add a payment card there.
2. In Shippo, go to **Settings › Advanced › API** and click **Generate token** next to *Live token*. Copy it (it starts with `shippo_live_`).
3. In the studio: **Sign in menu › your shop › Shipping labels**. Paste the token, fill in the ship-from address and usual box, and click **Save**.

Owners who ship some other way can type the carrier and tracking number in the same Ship window instead.

Optional, for you: to let every owner try **test** labels before they sign up, paste your own Shippo **test** token (`shippo_test_…`, same page in Shippo) into Vercel as `SHIPPO_API_KEY` and redeploy. A live token there is ignored, so you're never billed for other people's postage.

## Custom quotes

Quote requests appear in **Admin > Orders > Payments** as **Needs a price**. Type the design fee and, if there is one, the monthly price, and click **Set price**. The pay link is copied for you; paste it into an email to the customer. The same **Copy pay link** button works for any unpaid order, such as a customer whose card was declined.

## Prices

What customers are charged comes from `server/catalog.js`, not from **Admin > Plans & pricing** (that page only changes what the Studio shows, in your browser). If you change a price, ask for both to be updated.

## Fees (check each company's site for current rates)

- Stripe: about 2.9% + 30¢ per US card payment; ACH, Klarna, Afterpay and Cash App Pay have their own rates.
- PayPal and Venmo: about 3.5% + 49¢ per payment.
- Zelle: no fee from Zelle; ask your bank about business account limits.
