# Google Play Submission Pack

Package name: `com.almas.app`

Recommended app category: `Shopping`

Recommended target audience: `18 and over`

## Store Listing

### App name

`Almas`

### Short description

`B2B spice catalog, cart, and restaurant ordering support from Almas.`

### Full description

`Almas helps restaurants and professional kitchens browse spice products, build an order draft, and contact Almas quickly from one place.

Use Almas to:

- browse product collections and featured items
- view product details and bundle suggestions
- add products to a draft cart
- review pricing and cash-on-delivery order totals
- view restaurant profile and operational summary screens
- contact Almas by phone, WhatsApp, website, or map/navigation links

The current release is focused on a clean business storefront experience for B2B buyers. It does not require account creation or login to access the main app experience.

Almas is designed for restaurant and hospitality purchasing workflows, with fast catalog access, order-draft review, and direct support contact options.`

## App Content Answers

Use these answers unless you change the app behavior before release.

### Privacy policy

- Answer: `Yes`
- URL: `https://amranihub.github.io/almas/privacy-policy.html`
- Backup URL (if you have your own domain): `https://almas.ma/privacy`
- The HTML page is ready at `docs/privacy-policy.html` — see `RELEASE_CHECKLIST.md` for GitHub Pages setup

### Ads

- Answer: `No`

### App access

- Answer: `No, all functionality is available without special access`
- Reviewer instructions:

`No login, password, OTP, invitation code, location gate, or membership is required. Reviewers can open the app and access the Home, Catalog, Cart, Ops, Profile, order, and local chat demo screens directly after launch.`

### Target audience and content

- Primary audience: `18 and over`
- Select younger age groups: `No`
- Appeal to children: `No`
- Primarily child-directed: `No`

### Sensitive permissions / Permissions Declaration Form

- Answer: `Not required for the current release`
- Reason: the release manifest only keeps `android.permission.INTERNET`

### Content ratings

Use conservative answers based on the current app:

- Violence: `None`
- Blood/Gore: `None`
- Sexual content or nudity: `None`
- Profanity or crude language: `None`
- Controlled substances: `None`
- Gambling or simulated gambling: `None`
- Horror/Fear: `None`
- Illegal acts: `None`
- User-generated content: `No`
- Real-time user-to-user interaction: `No`
- Location sharing: `No`
- Digital purchases: `No`

Notes:

- The current in-app chat page is a local demo UI and is not backed by a live messaging service.
- WhatsApp, phone, website, and navigation actions open external apps or services.

### Data safety

Recommended answers for the current release:

- Does your app collect or share any required user data types: `No`
- Is all user data encrypted in transit: `Not applicable for the current release answer above`
- Can users request data deletion: `Not applicable because the current release does not provide in-app accounts`

Important:

- If you later enable Firebase auth, backend chat, push notifications, analytics, location, or any server-side order/account storage, you must update the Data safety answers before publishing that version.

### News and Magazine apps

- Answer: `No`

### COVID-19 contact tracing and status apps

- Answer: `No`

## Reviewer Notes

Paste this into the review notes field if needed:

`Almas is a business storefront app for restaurant buyers. The current release allows product browsing, local cart drafting, operational overview screens, and direct external contact actions such as phone, WhatsApp, website, and navigation links. The app does not require login or special credentials for review.`
