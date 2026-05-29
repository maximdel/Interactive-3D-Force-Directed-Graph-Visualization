require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT;

// The graph API is dynamic and should never be revalidated from cache.
app.disable('etag');
app.use('/api', (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const COUCH_URL = process.env.COUCHDB_URL;
const COUCH_DB = process.env.COUCHDB_DATABASE;
const COUCH_USER = process.env.COUCHDB_USER;
const COUCH_PASS = process.env.COUCHDB_PASSWORD;

app.use(express.static(path.join(__dirname, '../../public')));
app.use('/client', express.static(path.join(__dirname, '../client')));

function authHeader() {
  const basic = Buffer.from(`${COUCH_USER}:${COUCH_PASS}`).toString('base64');
  return {
    Authorization: `Basic ${basic}`,
    'Content-Type': 'application/json',
  };
}

async function queryCouchDB(viewOrQuery) {
  const url = `${COUCH_URL.replace(/\/$/, '')}/${COUCH_DB}/${viewOrQuery}`;
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`CouchDB query failed: ${res.status}`);
  return res.json();
}

app.get('/api/nodes', async (req, res) => {
  try {
    const result = await queryCouchDB('_all_docs?include_docs=true');
    const nodes = result.rows
      .filter(
        (r) =>
          r.doc &&
          (r.doc.type === 'project' ||
            r.doc.type === 'organization' ||
            r.doc.type === 'topic'),
      )
      .map((r) => {
        const doc = r.doc;
        let label, color;

        if (doc.type === 'project') {
          label = doc.title || doc.acronym || 'Project';
          color = doc.status === 'SIGNED' ? '#4a9eff' : '#888888';
        } else if (doc.type === 'organization') {
          label = doc.shortName || doc.name;
          color = '#ff9a4a';
        } else if (doc.type === 'topic') {
          label = doc.title || doc.topic;
          color = '#4aff9a';
        }

        return {
          id: doc._id,
          label,
          color,
          type: doc.type,
          data: doc,
        };
      });

    res.json(nodes);
  } catch (err) {
    console.error('Error fetching nodes:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/links', async (req, res) => {
  try {
    const result = await queryCouchDB('_all_docs?include_docs=true');
    const links = result.rows
      .filter((r) => r.doc && r.doc.type === 'link')
      .map((r) => {
        const doc = r.doc;
        return {
          source: doc.source,
          target: doc.target,
          weight: doc.weight || 1.0,
          role: doc.role,
        };
      });

    res.json(links);
  } catch (err) {
    console.error('Error fetching links:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/graph', async (req, res) => {
  try {
    const result = await queryCouchDB('_all_docs?include_docs=true');
    const nodes = result.rows
      .filter(
        (r) =>
          r.doc &&
          (r.doc.type === 'project' ||
            r.doc.type === 'organization' ||
            r.doc.type === 'topic'),
      )
      .map((r) => {
        const doc = r.doc;
        let label, color;

        if (doc.type === 'project') {
          label = doc.title || doc.acronym || 'Project';
          color = doc.status === 'SIGNED' ? '#4a9eff' : '#888888';
        } else if (doc.type === 'organization') {
          label = doc.shortName || doc.name;
          color = '#ff9a4a';
        } else if (doc.type === 'topic') {
          label = doc.title || doc.topic;
          color = '#4aff9a';
        }

        return {
          id: doc._id,
          label,
          color,
          type: doc.type,
          data: doc,
        };
      });

    const links = result.rows
      .filter((r) => r.doc && r.doc.type === 'link')
      .map((r) => {
        const doc = r.doc;
        return {
          source: doc.source,
          target: doc.target,
          weight: doc.weight || 1.0,
          role: doc.role,
        };
      });

    res.json({ nodes, links });
  } catch (err) {
    console.error('Error building graph:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
