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

   The default URI uses the local MongoDB service at `mongodb://127.0.0.1:27017/bucks2bars`. For Atlas, set `MONGO_URI` in `.env` to your connection URI. Keep `.env` private; it is excluded from Git.

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

## Data storage

Yearly income and expense records are stored in the MongoDB `bucks2bars` database, in the `financeyears` collection. The frontend does not store tracker data in `localStorage`.