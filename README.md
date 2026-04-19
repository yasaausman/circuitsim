# CircuitSim

A full-stack, browser-based circuit simulator with a 3D canvas, real-time simulation, and an AI assistant — running locally or fully deployed on Vercel.

🔗 **Live Demo:** [circuitsim-api.vercel.app](https://circuitsim-api.vercel.app)

---

## Features

- **3D Circuit Canvas** — place and connect components on an interactive 3D grid powered by React Three Fiber
- **Component Library** — resistors, capacitors, inductors, voltage sources, bulbs, and ground nodes
- **Real-Time Simulation** — solve circuits instantly using a shared TypeScript simulation engine
- **Property Inspector** — click any component to view and edit its values
- **AI Assistant** — describe what you want and the AI panel will help build or modify your circuit using Gemini
- **Wire Routing** — connect components visually with draggable wires

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| 3D Rendering | Three.js, React Three Fiber, Drei |
| State Management | Zustand |
| Backend API | Hono, Node.js, TypeScript |
| Simulation Engine | Custom TypeScript solver (shared workspace package) |
| AI | Google Gemini (`@google/generative-ai`) |
| Deployment | Vercel (frontend + serverless API) |

---

## Project Structure

```
circuitsim/
├── api/
│   ├── _entry.ts             # Vercel function source (bundled by esbuild at build time)
│   └── index.js              # Placeholder — overwritten during Vercel build
├── apps/
│   └── web/                  # React + Vite frontend
│       └── src/
│           ├── components/
│           │   ├── Canvas3D/ # 3D circuit canvas, component meshes, wires
│           │   └── UI/       # AI panel, toolbar, property panel, sim controls
│           ├── store/        # Zustand global state
│           └── lib/          # Shared utilities
├── packages/
│   ├── api/                  # Hono backend (validation, simulation, AI routes)
│   └── engine/               # Circuit solver logic shared by frontend and API
├── vercel.json               # Vercel deployment config
```

---

## Getting Started (Local)

### Requirements

- [Node.js](https://nodejs.org/) (v18 or later)
- npm or [Bun](https://bun.sh/)

### Install dependencies

```bash
npm install
```

### Set up environment variables

Create a `.env` file inside `packages/api/`:

```bash
cp packages/api/.env.example packages/api/.env
```

Then open `packages/api/.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

> You can get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com)

### Run the project

```bash
npm run dev
```

This starts both servers:

| Server | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |

Open **http://localhost:5173** in your browser.

---

## Deployment (Vercel)

This project is deployed entirely on Vercel — both the frontend and the API.

### How it works

- The **frontend** (React + Vite) is built to `apps/web/dist` and served as static files
- The **API** (`api/_entry.ts`) is pre-bundled into a single `api/index.js` file using esbuild, then deployed as a Vercel serverless function
- All `/api/*` requests are routed to the serverless function via `vercel.json` rewrites

### Deploy your own

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. In **Settings → Framework Preset**, set to **Vite**
4. In **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` → your Gemini API key
5. Click **Deploy**

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/circuit/validate` | Validate a circuit payload |
| `POST` | `/api/simulate` | Run a circuit simulation |
| `POST` | `/api/ai/chat` | Send a message to the AI circuit assistant |

---

## Available Scripts

Run these from the project root:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend and backend together |
| `npm run build` | Build engine, API, and web app |
| `npm run typecheck` | Run TypeScript checks across all packages |

---

## How It Works

```
Browser (localhost:5173 or Vercel)
   │
   │  /api/... requests
   ▼
Vite proxy (dev) / Vercel rewrite (prod)
   │
   │  forwards to
   ▼
Hono API (localhost:3001 or Vercel serverless)
   │
   ├── /api/circuit/validate
   ├── /api/simulate  ──► Engine (TypeScript solver)
   └── /api/ai/chat   ──► Gemini AI
```

Circuit state lives in the browser. The API handles simulation math and AI calls.

---

## Troubleshooting

**Port already in use (`EADDRINUSE`)**

```bash
# Windows
Get-Process node | Stop-Process -Force
npm run dev
```

**Check if servers are running**

```bash
# Windows
Get-NetTCPConnection -LocalPort 5173,3001 -State Listen
```

**Test the API directly**

```bash
curl http://localhost:3001/health
# expected: {"ok":true}
```
