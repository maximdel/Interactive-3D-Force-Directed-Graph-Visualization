/**
 * This is an import template that reads project/organization/topic Excel files and uploads documents to CouchDB (in bulk). Intended as a starting point —
 * review field mappings before running against production data.
 *
 * Requirements:
 *   npm install xlsx
 *
 * Usage:
 *   node scripts/import-excel-to-couchdb.js --projects=data/project.xlsx \
 *     --organizations=data/organization.xlsx --topics=data/topics.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const COUCH_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCH_DB = process.env.COUCHDB_DATABASE || 'graph_db';
const COUCH_USER = process.env.COUCHDB_USER || 'admin';
const COUCH_PASS = process.env.COUCHDB_PASSWORD || 'password';

function readSheet(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const first = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: null });
}

function authHeaders() {
  const basic = Buffer.from(`${COUCH_USER}:${COUCH_PASS}`).toString('base64');
  return {
    Authorization: `Basic ${basic}`,
    'Content-Type': 'application/json',
  };
}

async function bulkUpload(docs) {
  const url = `${COUCH_URL.replace(/\/$/, '')}/${COUCH_DB}/_bulk_docs`;
  const body = JSON.stringify({ docs });
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  if (!res.ok) {
    throw new Error(`Bulk upload failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function mapRowsToDocs(rows, type, idField) {
  return rows.map((r) => {
    const _id = r[idField] ? `${type}:${r[idField]}` : undefined;
    return Object.assign({}, r, { type, _id });
  });
}

async function main() {
  const argv = require('minimist')(process.argv.slice(2));

  const projectsFile = argv.projects || argv.p || 'data/project.xlsx';
  const orgsFile = argv.organizations || argv.orgs || 'data/organization.xlsx';
  const topicsFile = argv.topics || 'data/topics.xlsx';

  console.log('Reading Excel files...');
  const projects = readSheet(path.resolve(projectsFile));
  const orgs = readSheet(path.resolve(orgsFile));
  const topics = readSheet(path.resolve(topicsFile));

  // Basic mapping: set `type` and _id for CouchDB documents.
  const projectDocs = mapRowsToDocs(projects, 'project', 'projectid');
  const orgDocs = mapRowsToDocs(orgs, 'organization', 'projectid');
  const topicDocs = mapRowsToDocs(topics, 'topic', 'projectid');

  // Example: if you want to construct node/link graph docs instead,
  // transform these rows into `node` and `link` documents here.

  const allDocs = [...projectDocs, ...orgDocs, ...topicDocs];

  console.log(`Uploading ${allDocs.length} docs to ${COUCH_DB}...`);
  try {
    const result = await bulkUpload(allDocs);
    console.log('Upload result sample:', result.slice(0, 5));
  } catch (err) {
    console.error('Failed to upload docs:', err);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
