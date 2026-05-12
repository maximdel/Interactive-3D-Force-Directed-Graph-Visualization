# CouchDB Setup Notes

Quick reference for the CouchDB setup I applied for this project.

## What I did

- Installed CouchDB from the official app.
- Created admin user with strong password (stored in `.env`).
- Set up `graph_db` as the main database for all graph documents (projects, organizations, topics).
- Enabled CORS in `local.ini` to allow requests from the Express backend to the CouchDB HTTP API.

## CouchDB config (local.ini)

Under `[cors]` section:

```
origins = *
credentials = true
methods = GET, PUT, POST, HEAD, DELETE
headers = accept, authorization, content-type, origin, referer
```

Restarted CouchDB after editing `local.ini`.

## Database structure

Using single `graph_db` with a `type` field to distinguish document kinds:

- Documents with `type: "project"` → project metadata
- Documents with `type: "organization"` → organization info
- Documents with `type: "topic"` → topic/theme info
- Documents with `type: "node"` / `type: "link"` → computed graph structure (later)

Alternative: could split into separate DBs (`projects`, `organizations`, `topics`) but single DB is simpler for now.

## CouchDB URLs

- Fauxton admin UI: http://127.0.0.1:5984/_utils/
- Direct HTTP API: http://127.0.0.1:5984

## Environment variables

- `COUCHDB_URL=http://localhost:5984`
- `COUCHDB_USER=admin`
- `COUCHDB_PASSWORD=example_password`
- `COUCHDB_DATABASE=graph_db`

## Data import

The `scripts/import-excel-to-couchdb.js` script reads the three Excel files and bulk-uploads documents to CouchDB. SIt istill a template, I need to refine field mappings when I understand the exact Excel structure better.
