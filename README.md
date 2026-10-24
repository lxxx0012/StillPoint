# Stillpoint

A calm event discovery and registration site with an admin console and stable, redirectable QR codes.

## Run locally

1. Install Node.js and MongoDB (or use a MongoDB Atlas connection string).
2. In this directory, run `npm install`.
3. Copy `.env.example` to `.env`. Set `MONGODB_URI`, a long random `JWT_SECRET`, `BASE_URL`, and `ADMIN_EMAIL`.
4. Run `npm run dev` and open the printed local URL.

For a visual-only preview, open `index.html` in this project folder. The preview includes sample gatherings; sign in, registration, and live event data require the Node server and MongoDB.

The app seeds four sample events on first connection. Set `ADMIN_EMAIL` to the email address that should own the admin role, then create that account at `/register`. For a public deployment, use a private, controlled admin email and change `JWT_SECRET` and `BASE_URL` to production values. Never publish `.env`.

## Stable event QR codes

An event QR encodes the app's `/go/:slug` address. That slug is retained when an admin edits the event. The redirect handler reads the current `destinationUrl` from MongoDB, so admins can change ticketing or event destinations without replacing the QR code. The QR PNG is generated from that stable address in the admin console and can be downloaded for print.

Archiving preserves the event and its registration history while disabling its redirect. Permanent QR redirects require this app to remain deployed at the same `BASE_URL` and the event record to remain available.

## Pages

- `/` event discovery
- `/register` account creation
- `/login` sign in
- `/dashboard` upcoming registrations and past event history
- `/admin` event management and QR downloads (admin account only)
- `/about` and `/contact` information pages

The matching standalone page shells are also available under `public/` as `login.html`, `register.html`, `dashboard.html`, `user.html`, `admin.html`, `about.html`, and `contact.html`. Both the clean routes above and these `.html` paths render the same shared views.

## Stack

Node.js, Express, MongoDB/Mongoose, vanilla HTML/CSS/JavaScript, bcrypt password hashing, JWT authentication, and `qrcode` for QR generation.
