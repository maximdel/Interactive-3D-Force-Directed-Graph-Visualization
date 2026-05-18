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

// loads COUCHDB_URL, COUCHDB_DATABASE, COUCHDB_USER, COUCHDB_PASSWORD from .env
require('dotenv').config();
const argv = require('minimist')(process.argv.slice(2));

const COUCH_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCH_DB = process.env.COUCHDB_DATABASE || 'graph_db';
const COUCH_USER = process.env.COUCHDB_USER || undefined;
const COUCH_PASS = process.env.COUCHDB_PASSWORD || undefined;

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
  const timeoutMs = parseInt(argv.timeoutMs || 120000, 10);
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Bulk upload failed: ${res.status} ${res.statusText} - ${errorText}`,
    );
  }
  return res.json();
}

async function uploadInBatches(docs, batchSize) {
  let processed = 0;
  let failed = 0;
  let conflicts = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const chunkIndex = Math.floor(i / batchSize) + 1;
    const totalChunks = Math.ceil(docs.length / batchSize);

    console.log(
      `  Uploading batch ${chunkIndex}/${totalChunks} (${chunk.length} docs)...`,
    );
    const result = await bulkUpload(chunk);

    processed += result.length;
    const chunkFailed = result.filter((r) => r.error).length;
    const chunkConflicts = result.filter((r) => r.error === 'conflict').length;
    failed += chunkFailed;
    conflicts += chunkConflicts;

    if (chunkFailed > 0) {
      console.warn(
        `    Batch warnings: ${chunkFailed} failed (${chunkConflicts} conflicts).`,
      );
    }
  }

  return { processed, failed, conflicts };
}

function mapRowsToDocs(rows, type, idField) {
  return rows.map((r) => {
    const _id = r[idField] ? `${type}:${r[idField]}` : undefined;
    return Object.assign({}, r, { type, _id });
  });
}

function dedupOrganizations(orgRows) {
  const seen = {};
  const docs = [];

  orgRows.forEach((row) => {
    const vatKey = row.vatNumber || row.name;
    if (!seen[vatKey]) {
      seen[vatKey] = true;
      const doc = {
        _id: `organization:${vatKey}`,
        type: 'organization',
        name: row.name,
        shortName: row.shortName,
        activityType: row.activityType,
        country: row.country,
        city: row.city,
        url: row.organizationURL,
        vatNumber: row.vatNumber,
      };
      docs.push(doc);
    }
  });

  return docs;
}

function dedupTopics(topicRows) {
  const seen = {};
  const docs = [];

  topicRows.forEach((row) => {
    const topicKey = row.topic;
    if (!seen[topicKey]) {
      seen[topicKey] = true;
      const doc = {
        _id: `topic:${topicKey}`,
        type: 'topic',
        topic: row.topic,
        title: row.title,
      };
      docs.push(doc);
    }
  });

  return docs;
}

function projectsToDocs(projectRows) {
  return projectRows.map((row) => ({
    _id: `project:${row.id}`,
    type: 'project',
    id: row.id,
    acronym: row.acronym,
    status: row.status,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    totalCost: row.totalCost,
    ecMaxContribution: row.ecMaxContribution,
    fundingScheme: row.fundingScheme,
    objective: row.objective,
    keywords: row.keywords,
  }));
}

function projectOrgLinks(orgRows) {
  return orgRows.map((row) => ({
    _id: `link:project:${row.projectID}:org:${row.vatNumber || row.name}`,
    type: 'link',
    source: `project:${row.projectID}`,
    target: `organization:${row.vatNumber || row.name}`,
    role: row.role,
    weight: 1.0,
  }));
}

function projectTopicLinks(topicRows) {
  return topicRows.map((row) => ({
    _id: `link:project:${row.projectID}:topic:${row.topic}`,
    type: 'link',
    source: `project:${row.projectID}`,
    target: `topic:${row.topic}`,
    weight: 1.0,
  }));
}

async function main() {
  const projectsFile =
    argv.projects || argv.p || 'cordis-HORIZONprojects-xlsx/project.xlsx';
  const orgsFile =
    argv.organizations ||
    argv.orgs ||
    'cordis-HORIZONprojects-xlsx/organization.xlsx';
  const topicsFile = argv.topics || 'cordis-HORIZONprojects-xlsx/topics.xlsx';

  if (!COUCH_USER || !COUCH_PASS) {
    console.warn(
      'Warning: COUCHDB_USER or COUCHDB_PASSWORD not set in environment; requests may be unauthorized.',
    );
  }

  console.log('Reading Excel files...');
  const projects = readSheet(path.resolve(projectsFile));
  const orgs = readSheet(path.resolve(orgsFile));
  const topics = readSheet(path.resolve(topicsFile));

  console.log(`  Projects: ${projects.length} rows`);
  console.log(`  Organizations: ${orgs.length} rows`);
  console.log(`  Topics: ${topics.length} rows`);

  console.log('\nBuilding documents (deduplicate orgs/topics)...');

  // support a --limit for small test runs
  const limit = parseInt(argv.limit || 0, 10);
  const projectsSlice = limit > 0 ? projects.slice(0, limit) : projects;
  const orgsSlice = limit > 0 ? orgs.slice(0, limit) : orgs;
  const topicsSlice = limit > 0 ? topics.slice(0, limit) : topics;

  const projectDocs = projectsToDocs(projectsSlice);
  const orgDocs = dedupOrganizations(orgsSlice);
  const topicDocs = dedupTopics(topicsSlice);
  const projectOrgLinkDocs = projectOrgLinks(orgsSlice);
  const projectTopicLinkDocs = projectTopicLinks(topicsSlice);

  const allDocs = [
    ...projectDocs,
    ...orgDocs,
    ...topicDocs,
    ...projectOrgLinkDocs,
    ...projectTopicLinkDocs,
  ];

  console.log(`\nDocuments to upload:`);
  console.log(`  Projects: ${projectDocs.length}`);
  console.log(`  Organizations (unique): ${orgDocs.length}`);
  console.log(`  Topics (unique): ${topicDocs.length}`);
  console.log(`  Project→Org links: ${projectOrgLinkDocs.length}`);
  console.log(`  Project→Topic links: ${projectTopicLinkDocs.length}`);
  console.log(`  Total: ${allDocs.length}`);

  if (argv.dryRun) {
    console.log(
      '\nDry run enabled — skipping upload. Use --limit=N to limit rows for tests.',
    );
    return;
  }

  const batchSize = parseInt(argv.batchSize || 2000, 10);
  console.log(
    `\nUploading to ${COUCH_URL}/${COUCH_DB} in batches of ${batchSize}...`,
  );
  try {
    const summary = await uploadInBatches(allDocs, batchSize);
    console.log(`Upload complete. Processed ${summary.processed} docs.`);
    if (summary.failed > 0) {
      console.warn(
        `   ${summary.failed} docs failed total (${summary.conflicts} conflicts).`,
      );
      if (summary.conflicts > 0) {
        console.warn(
          '  Note: conflicts are expected when re-importing existing _id values.',
        );
      }
    } else {
      console.log('  ✓ All docs uploaded successfully.');
    }
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      console.error(
        'Authentication failed (401). Verify COUCHDB_USER/COUCHDB_PASSWORD and that the user has permission to write to the database.',
      );
    }
    console.error('Failed to upload docs:', err);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
