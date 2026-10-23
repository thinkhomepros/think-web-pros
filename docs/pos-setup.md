# Register (POS) setup

The register lives at **/pos** (for example https://think-web-pros.vercel.app/pos) and the kitchen screen at **/kitchen**.
They run in any modern browser on an iPad, Android tablet, phone or computer, can be installed like an app, and keep
ringing up cash sales when the internet drops. Card sales need the internet.

## Try it right now (nothing to set up)

1. Open **/pos** and tap **Just try it**, then **Open practice register**.
2. Tap **Owner** and type **1234** (the cashier "Sam" is **1111**).
3. Count a starting drawer, ring up a sale, tip, split it between the practice card reader and cash, refund part of it,
   then look at **Reports**.
4. In another tab of the same browser open **/kitchen** and tap **Practice**: food items show up as tickets.

Practice mode keeps everything in that browser and never charges a card.

## Set up a real shop

1. On the tablet, open **/pos** and **Sign in** with the shop's Think Web Pros account (or tap **Create an account**).
2. Pick the owner's register PIN and the sales tax rate, then tap **Set up this register**.
3. Products from the shop's published website come over by themselves with the same stock counts the online store uses.
   Add counter-only items (a food menu, services, a custom amount) under **Products**.
4. Add staff under **Settings → Staff**. Cashiers ring up sales. Managers can also refund, give bigger discounts, take
   cash out, see reports and change products. Owners can also change settings and staff. Everyone has their own PIN.
5. More registers or a kitchen screen: on a set-up register open **Settings → Devices & card readers**, tap
   **Add a register** or **Add a kitchen screen**, and type the 6-digit code on the new device.
6. Install it like an app: in Safari tap Share, then **Add to Home Screen**. In Chrome tap **Install** in the address bar
   (or **Settings → This register → Install as an app**).

## Card readers (Stripe Terminal)

The register uses Stripe's smart readers over the internet: **Stripe Reader S700** or **BBPOS WisePOS E**. They work with
iPads, Android tablets and computers because the register never connects to the reader directly; Stripe does.
(The small Bluetooth M2 reader and Tap to Pay need a phone app and don't work from a web page.)

### Test mode (no hardware, no real money)

1. In Vercel: **Project → Settings → Environment Variables**, set `STRIPE_SECRET_KEY` to your **test** secret key
   (Stripe Dashboard → turn on **Test mode** → **Developers → API keys → Secret key**, starts with `sk_test_`).
   Redeploy.
2. On the register: **Settings → Devices & card readers → Add Stripe's simulated reader**.
3. Ring up a sale and choose **Card**. Tap **Visa that works** to approve or **Declined card** to see a decline.

### Live (real cards)

1. Each shop connects its own Stripe account first (Studio → Owner dashboard → **Set up card payments**), so card money goes
   straight to the shop's bank. The register refuses live cards until that is done.
2. Order readers from the shop's Stripe Dashboard: **More → Terminal → Shop** (or Stripe's hardware shop). An S700 is
   about $349 and a WisePOS E about $249 (check Stripe for current prices).
3. Turn the reader on and connect it to Wi-Fi. Swipe in from the left edge, tap **Settings**, then
   **Generate pairing code**. It shows three words like `apple-banana-cherry`.
4. On the register: **Settings → Devices & card readers**, type the three words, give it a name, tap **Add reader**.
   The register picks it for itself. Each register can use its own reader.
5. Set `STRIPE_SECRET_KEY` in Vercel to the **live** key (`sk_live_…`) when you're ready to charge real cards.

Think Web Pros' cut of each register card payment comes from `POS_FEE_PERCENT` and `POS_FEE_CENTS` (for example 0.5 and
5 is 0.5% + 5¢ on top of Stripe's own fee, which the shop pays). Both are 0 until you set them.

## Receipts, printers, scanners and cash drawers

- **Print**: any printer the device can print to. For 80 mm receipt printers (Star TSP143IV, Epson TM-m30III), choose the
  receipt paper size in the print dialog.
- **Cash drawer**: plug it into the receipt printer and turn on "open drawer when printing" in the printer's settings.
  **Drawer → Open drawer (no sale)** prints a small slip to pop it.
- **Email receipts**: sign up at resend.com, verify your domain, then set `RESEND_API_KEY` and `RECEIPT_FROM` in Vercel.
- **Text receipts**: sign up at twilio.com, buy a number, then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
  `TWILIO_FROM`. Until these are set, Email and Text open the device's own mail or messages app with the receipt.
- **Barcode scanners**: any USB or Bluetooth scanner that types like a keyboard. Put the barcode on a product under
  **Products**, then scan on the Sell screen.

## What has to be on the server

- **Upstash Redis** (Vercel → Storage), which the online store already needs. Without it, sales and stock are forgotten
  between requests on Vercel. Registers still keep their own copy of every sale until it reaches the server.
- `STRIPE_SECRET_KEY` for card readers (above). Everything else is optional.
