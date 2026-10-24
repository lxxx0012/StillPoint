<<<<<<< HEAD
# Stillpoint

A calm event discovery and registration site with an admin console and stable, redirectable QR codes.

## Create a MongoDB Atlas database

1. Create or sign in to an account at [MongoDB Atlas](https://www.mongodb.com/atlas/database), create a project, then create a **Free** cluster. Pick a cloud provider and region near the Node app. MongoDB’s [free-cluster guide](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) has the current Atlas screens.
2. In **Security → Database & Network Access → IP Access List**, add your current IP address for local development. Atlas only accepts connections from IPs on this list; add your deployed server’s outbound IP when you deploy. Avoid `0.0.0.0/0` for a persistent setup. See [manage the IP access list](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
3. Under **Database & Network Access → Database Users**, create an application database user with password authentication and read/write access to the `stillpoint` database. This Atlas database user is separate from the website’s admin and guest accounts. See [configure database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
4. In the cluster’s **Connect** dialog choose **Drivers → Node.js**, copy the `mongodb+srv://` connection string, and replace its password placeholder with the database-user password. URL-encode special characters in the username or password. MongoDB’s [driver connection guide](https://www.mongodb.com/docs/atlas/driver-connection/) shows this flow.
5. In the project folder, copy `.env.example` to `.env` and set:

   ```dotenv
   PORT=3000
   MONGODB_URI=mongodb+srv://<db-user>:<url-encoded-password>@<your-cluster-host>/stillpoint?retryWrites=true&w=majority
   JWT_SECRET=<a-long-random-secret>
   BASE_URL=http://localhost:3000
   ADMIN_EMAIL=admin@stillpoint.test
   ```

   Use Atlas’s copied hostname and your database username/password. Keep `.env` private; it is excluded by `.gitignore`.

## Create test accounts and run

In the project folder, run:

```powershell
npm install
npm run seed:test-users
npm run dev
```

The first command installs dependencies. The test seeder connects to the configured Atlas database and creates or resets two **test-only** website accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@stillpoint.test` | `StillpointAdmin!26` |
| User | `guest@stillpoint.test` | `StillpointGuest!26` |

Sign in at `http://localhost:3000/login`. The admin lands on `/admin`; the user lands on `/dashboard`. The seeder is opt-in and only runs when you call `npm run seed:test-users`. Change these credentials and `JWT_SECRET` before any public deployment. The app also seeds four sample events the first time it connects.

For a visual-only preview, open `index.html` in this project folder. That preview uses sample gatherings; sign-in, registration, and live data require the Node server and Atlas connection.

## One shared, redirectable QR code

The admin page creates a single QR that encodes `/go/current`. Downloading it from any event leads to the same QR image. In the admin panel, choose an active event as the QR destination; MongoDB stores that choice, and the redirect immediately sends scanners to that event's current `destinationUrl`. Admins can also edit the destination URL without reprinting. Older event-specific `/go/:slug` links remain supported.

For a printed QR to keep working, deploy the app at a stable public domain and set `BASE_URL` to that domain before downloading the shared QR. Archiving an event disables that event-specific route; if the archived event was selected for the shared QR, the shared QR falls back to the next upcoming active event. The redirect only works while the app and domain remain available.

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
=======
# StillPoint
>>>>>>> d705d24e39deb93f07febc43a25fddcba0450c80
