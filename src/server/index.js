require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

const NODE_TYPES = new Set(['project', 'organization', 'topic']);

function docToNode(doc) {
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

  return { id: doc._id, label, color, type: doc.type, data: doc };
}

function docToLink(doc) {
  return {
    source: doc.source,
    target: doc.target,
    weight: doc.weight || 1.0,
    role: doc.role,
  };
}

async function fetchAllDocs() {
  const result = await queryCouchDB('_all_docs?include_docs=true');
  const nodes = [];
  const links = [];

  for (const row of result.rows) {
    const doc = row.doc;
    if (!doc) continue;

    if (NODE_TYPES.has(doc.type)) {
      nodes.push(docToNode(doc));
    } else if (doc.type === 'link') {
      links.push(docToLink(doc));
    }
  }

  return { nodes, links };
}

app.get('/api/nodes', async (req, res) => {
  try {
    const { nodes } = await fetchAllDocs();
    res.json(nodes);
  } catch (err) {
    console.error('Error fetching nodes:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/links', async (req, res) => {
  try {
    const { links } = await fetchAllDocs();
    res.json(links);
  } catch (err) {
    console.error('Error fetching links:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/graph', async (req, res) => {
  try {
    const { nodes, links } = await fetchAllDocs();
    res.json({ nodes, links });
  } catch (err) {
    console.error('Error building graph:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
