# Interactive 3D Force-Directed Graph Visualization

Research & Expertise Project Digital Solutions (Sem 2) [MBI62j] — Maxim Delloye

A web-based tool that renders an interactive 3D force-directed graph using [3d-force-graph](https://github.com/vasturiano/3d-force-graph) and Three.js, backed by a Node.js/Express server with CouchDB for data storage.

## Requirements

- Node.js 20+
- npm
- CouchDB (optional for now)

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  server/     Express server and API routes
  client/     Frontend JavaScript
public/       Static HTML and assets
data/         Source data files (Excel, CSV)
scripts/      Utility scripts
docs/         Project notes
```

## API

| Method | Path       | Description        |
|--------|------------|--------------------|
| GET    | /api/graph | Returns graph JSON |

## Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Three.js, 3d-force-graph
- **Database**: CouchDB (planned)
