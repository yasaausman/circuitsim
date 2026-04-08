# CircuitSim

CircuitSim is a local full-stack circuit simulator project with:

- a React + Vite frontend for building and viewing circuits
- a shared TypeScript simulation engine
- a Hono API for validation, simulation, and AI-assisted circuit editing

The app is designed to run on your own computer through `localhost`.

## What The Project Does

CircuitSim gives you a visual interface for working with circuits in a 3D canvas. You can:

- place components such as resistors, capacitors, inductors, sources, bulbs, and ground
- connect them with wires
- inspect and edit properties
- run simulations
- use an AI panel to help build or modify a circuit

The frontend is the part you open in your browser. The backend handles simulation requests and AI requests behind the scenes.

## Project Structure

This repository is split into a few main parts:

- `apps/web`
  The browser app built with React and Vite.
- `packages/api`
  The backend server built with Hono and TypeScript.
- `packages/engine`
  The shared circuit simulation logic used by the API.

## How Localhost Works In This Project

When you run the project locally, two servers start:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

You normally open only the frontend in your browser:

`http://localhost:5173`

When the frontend needs backend help, it sends requests to `/api/...`.

Vite is configured to forward those requests to:

`http://localhost:3001`

So the flow is:

1. You open the web app on port `5173`
2. The web app loads in your browser
3. When it needs simulation or AI help, it calls `/api/...`
4. Vite forwards that request to the API on port `3001`
5. The API returns the result
6. The frontend shows that result to you

## Requirements

Before running the project, make sure you have:

- Node.js installed
- npm available in PowerShell or your terminal

Dependencies already appear to be installed in this repository because `node_modules` is present.

## Environment Variables

The API uses an environment file in:

`packages/api/.env`

Example values are shown in:

`packages/api/.env.example`

The main variable used by the AI route is:

- `GEMINI_API_KEY`

The API port can also be set with:

- `PORT`

If `PORT` is not set, the API defaults to `3001`.

## Running The Project

Open PowerShell in the project folder and run:

```powershell
cd C:\Users\HP\OneDrive\Desktop\circuitsim
npm run dev
```

That command starts both:

- the API server
- the web server

Then open this in your browser:

`http://localhost:5173`

## How To Know It Started Correctly

When the project starts properly, you should see:

- a Vite message showing the frontend is ready
- an API message showing the backend is listening on port `3001`

You can also test both manually:

```powershell
Invoke-WebRequest http://localhost:5173
Invoke-WebRequest http://localhost:3001/health
```

If the API is working, the health endpoint should return:

```json
{"ok":true}
```

## Common Local Issues

### Port Already In Use

If you see errors like:

- `Port 5173 is in use`
- `EADDRINUSE`

that means another copy of the app is already running.

You can stop the current run with:

```powershell
Ctrl + C
```

If needed, you can stop all Node processes with:

```powershell
Get-Process node | Stop-Process -Force
```

Then start again with:

```powershell
npm run dev
```

### Check Whether Local Servers Are Running

To see whether this project is using its usual ports:

```powershell
Get-NetTCPConnection -LocalPort 5173,3001 -State Listen
```

If those ports appear, something is listening there.

## Available Scripts

At the root of the repository:

- `npm run dev`
  Starts the frontend and backend together.
- `npm run build`
  Builds the engine, API, and web app.
- `npm run typecheck`
  Runs TypeScript checks across the workspace.

## API Endpoints

Some important backend routes:

- `GET /health`
  Simple health check
- `POST /api/circuit/validate`
  Validates a circuit payload
- `POST /api/simulate`
  Runs a circuit simulation
- `POST /api/ai/chat`
  Sends circuit context and chat messages to the AI assistant

## Notes

- Circuit state is primarily kept in the browser
- The API helps with validation, simulation, and AI features
- The AI route uses Gemini and supports server-side tool calling
