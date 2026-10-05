# bucks2bars

React + Vite frontend and Express + MongoDB API for tracking monthly income and daily expenses.

The code is separated into `frontend/` (React, Vite, Tailwind, Chart.js) and `backend/` (Express, Mongoose, MongoDB API). Shared npm scripts and the private `.env` file stay at the project root.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally, or a MongoDB Atlas connection URI

## Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create your environment file if you do not already have one:

   ```powershell
   Copy-Item .env.example .env
   ```

   The default URI uses the local MongoDB service at `mongodb://127.0.0.1:27017/bucks2bars`. For Atlas, set `MONGO_URI` in `.env` to your connection URI. Set `JWT_SECRET` to a long random value. Keep `.env` private; it is excluded from Git.

3. Start the React dev server and API:

   ```powershell
   npm run dev
   ```

4. Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173`.

## Production build

```powershell
npm run build
npm start
```

The Express server serves the production frontend and API from the same origin. The API health check is available at `/api/health`.

For Render, add both `MONGO_URI` and `JWT_SECRET` in the service environment settings. Generate a strong secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and do not commit it.

## Data storage

Accounts are stored in the `users` collection in the same MongoDB database. Passwords are bcrypt-hashed, sessions use an HTTP-only cookie, and finance records in `financeyears` are scoped by account. The frontend does not store passwords, session tokens, or tracker data in `localStorage`.

Existing finance records created before accounts were added remain in MongoDB without an owner and are not exposed to new accounts. This avoids assigning private data to the wrong user.