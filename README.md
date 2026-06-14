# Interactive 3D Force-Directed Graph Visualization

Research & Expertise Project Digital Solutions — Maxim Delloye

A web tool for exploring and visualizing the "EU Horizon research" dataset as an interactive 3D graph. Projects, organizations and topics are shown as nodes, and the links between them represent relationships like funding or participation. The graph is force-directed, which means nodes that are more connected will naturally cluster together.

## What it does

The graph has 3 types of nodes:

- **Projects** (blue) — EU Horizon research projects from the CORDIS dataset
- **Organizations** (orange) — universities, companies and other institutions that participate in projects
- **Topics** (green) — research topics that are linked to projects

You can click on any node to see more details, filter by country, year or funding scheme, and pin nodes in place so they don't move.

## Requirements

- Node.js 20 or higher
- npm
- CouchDB (running locally or on a server)

## Setup

### 1. Install dependencies

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in your CouchDB credentials (and the database name).

### 2. Set up CouchDB

See `docs/couchdb-setup.md` for the full setup. Shortly:

- Install CouchDB and create an admin user
- Create a database (the name should match `COUCHDB_DATABASE` in your `.env`)
- Enable CORS in `local.ini` so the Express server can communicate with CouchDB

### 3. Import the data

Put the three Excel files in the `data/` folder:

- `project.xlsx`
- `organization.xlsx`
- `topics.xlsx`

Then run the import script:

```bash
node scripts/import-excel-to-couchdb.js \
  --projects=data/project.xlsx \
  --organizations=data/organization.xlsx \
  --topics=data/topics.xlsx
```

You can first do a dry run to check if everything looks ok:

```bash
node scripts/import-excel-to-couchdb.js --dryRun
```

Or limit the import to test with a small amount of rows:

```bash
node scripts/import-excel-to-couchdb.js --limit=50
```

If you want to inspect what columns are in the Excel files before importing, use:

```bash
node scripts/inspect-excel.js
```

### 4. Start the server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Using the interface

### Search and filters

At the top of the page there are several filter controls:

- **Search** — type anything to search in project titles, objectives and keywords. Results shows the matching nodes and their direct neighbours in the graph.
- **Preview / Sample** — because the full dataset is very large, the app loads only a percentage of the data by default. The slider lets you choose how much (1%–10%). Click **Apply** to reload with the new sample. Turn off the **Preview** toggle to load the full dataset (this can be slow or unresponsive for very large data).
- **Node Types** — checkboxes to show or hide projects, organizations and topics
- **Projects** — filter by status (SIGNED or other), funding scheme, and start year range
- **Organisations** — filter by country or city

Active filters are shown as small chips below the controls. You can remove each filter separately or use "Clear all" to reset everything at once.

### Interacting with nodes

Click on a node to open the detail panel on the right side. It shows all the available information for that node (status, dates, funding, objective, etc.) and highlights the connected nodes in the graph.

The graph has two interaction modes that you can switch between with the buttons in the Layout section:

**Pin Mode** (default): clicking a node pins it to its current position so it does not move anymore with the simulation. The node gets a small golden glow to show it is pinned. Click the node again to unpin it. You can drag pinned nodes to reposition them. Pinned positions are saved in the browser so they are still there after you reload the page.

**Cluster Mode**: clicking on a organization or topic node collapses all the projects connected to it into that node. The label will show how many projects are hidden (for example "KU Leuven (+12)"). Click again to expand. This is useful for simplify a busy graph. You can also hold Shift and click a node while in Pin Mode to collapse it without switching modes.

The **Save Layout** button saves the current pins and collapsed clusters to the browser storage. **Clear Pins** removes all pins. **Expand All** expands any collapsed clusters.

### Link weights and particles

The sliders under **Links** control how strong the force simulation pulls connected nodes together. Higher values means the nodes are pull closer to each other.

The **Particles** section controls the animated dots that travel along the links. Orange particles are for organization links, green ones for topic links. You can adjust the count and speed.

## Project structure

```
src/
  server/     Express server and API routes
  client/     Frontend JavaScript (main.js)
public/       Static files (HTML, CSS)
data/         Excel data files *(not tracked in git)*
scripts/      Utility scripts (import, inspect)
docs/         Setup notes and data model docs
```

## API

| Method | Path       | Description                         |
| ------ | ---------- | ----------------------------------- |
| GET    | /api/graph | Returns all nodes and links as JSON |
| GET    | /api/nodes | Returns only the nodes              |
| GET    | /api/links | Returns only the links              |

The `/api/graph` response looks like:

```json
{
  "nodes": [
    { "id": "project:123", "label": "My Project", "type": "project", "color": "#4a9eff", "data": { ... } }
  ],
  "links": [
    { "source": "project:123", "target": "organization:456", "weight": 1.0, "role": "coordinator" }
  ]
}
```

## tech stack

- **Backend**: Node.js, Express 5
- **Frontend**: Vanilla JavaScript, Three.js, 3d-force-graph
- **Database**: CouchDB
- **Data import**: xlsx library (reads .xlsx files from CORDIS)
