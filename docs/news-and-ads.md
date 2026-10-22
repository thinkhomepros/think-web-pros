# News sites and ad spaces

## News or magazine business type

Six layouts in the studio's layout chooser: Daily newspaper, Glossy magazine, Community news, Digital newsroom,
Bold tabloid and Blog. Four new color themes: Gazette, Bulletin, Wire (dark) and Glossy.

New sections (also in the Sections menu for any site):

| Section | Layouts | Notes |
| --- | --- | --- |
| News stories | Headline hero, Story grid, Latest list, Magazine cover, By topic | Each story opens as a full article page with byline, share, related stories and a newsletter box. |
| Breaking news ticker | Scrolling, Still bar | Uses stories marked Breaking, or headlines the owner types. |
| Newsletter signup | Color band, Card, Beside a photo | Signups go to `state.subscribers` and the owner's messages. |
| Ad space | Banner, Boxed with label | One ad slot anywhere on a page. |
| Advertise with us | Cards, Table | Audience numbers, a price per spot and a request button. |

## Ad spaces

Open from the main menu (Ad spaces), an Ad space section, or the dashboard's Ads & sponsors card.

Suggested placements (standard IAB sizes):

| Spot | Size | Suggested for |
| --- | --- | --- |
| Top banner | 728 × 90, 320 × 50 on phones | News sites |
| Sidebar box | 300 × 250 | News sites |
| Between stories | In-feed card | News sites |
| Inside articles | 300 × 250 | News sites |
| Footer banner | 728 × 90, 320 × 100 on phones | Any site |
| Phone sticky banner | 320 × 50 | Any site |
| Ad space section | 728 × 90, 970 × 250, 300 × 250 and more | Any site |

Each spot shows one of: **Advertise here** (opens the ad request form), **Ad I sold** (image, link, start and
end dates), or **Google AdSense** (publisher ID plus an ad unit ID, or Auto ads).

Settings are saved with the design in `state.ads`. Advertiser requests are in `state.adRequests` and the
owner's messages.

## What works now and what doesn't

- Everything above works in the studio and Full screen preview, stored in the browser like the rest of a design.
- AdSense never loads in the studio or the preview. Slots show a labeled stand-in. This keeps owners from
  clicking their own ads (Google closes accounts for that) and keeps the studio's Content-Security-Policy
  closed to ad networks, so `vercel.json` is unchanged.
- Advertisers can't pay online yet. The owner approves a request, sends an invoice or payment link their own
  way, and marks it paid. Paying for ads online needs the customer's own payment account on their site; the
  Online payments work (PR #19) is for customers paying Think Web Pros, so it doesn't cover this by itself.
- Customer sites aren't hosted yet. When they are, the hosting needs to:
  - serve `/ads.txt` with `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` (the studio shows the line),
  - add the AdSense script to the page head and an `<ins class="adsbygoogle">` tag in each AdSense spot,
  - allow Google's ad hosts in that site's CSP (not the studio's): `script-src` and `frame-src` need
    `https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net
    https://*.google.com https://adservice.google.com https://tpc.googlesyndication.com`; `img-src`
    already allows `https:`; `connect-src` needs the same Google hosts,
  - show a consent message to visitors in Europe and the UK (AdSense has one built in).
