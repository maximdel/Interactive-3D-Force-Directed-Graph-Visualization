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
  const argv = require('minimist')(process.argv.slice(2));

  const projectsFile = argv.projects || argv.p || 'cordis-HORIZONprojects-xlsx/project.xlsx';
  const orgsFile = argv.organizations || argv.orgs || 'cordis-HORIZONprojects-xlsx/organization.xlsx';
  const topicsFile = argv.topics || 'cordis-HORIZONprojects-xlsx/topics.xlsx';

  console.log('Reading Excel files...');
  const projects = readSheet(path.resolve(projectsFile));
  const orgs = readSheet(path.resolve(orgsFile));
  const topics = readSheet(path.resolve(topicsFile));

  console.log(`  Projects: ${projects.length} rows`);
  console.log(`  Organizations: ${orgs.length} rows`);
  console.log(`  Topics: ${topics.length} rows`);

  console.log('\nBuilding documents (deduplicate orgs/topics)...');
  
  const projectDocs = projectsToDocs(projects);
  const orgDocs = dedupOrganizations(orgs);
  const topicDocs = dedupTopics(topics);
  const projectOrgLinkDocs = projectOrgLinks(orgs);
  const projectTopicLinkDocs = projectTopicLinks(topics);

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

  console.log(`\nUploading to ${COUCH_URL}/${COUCH_DB}...`);
  try {
    const result = await bulkUpload(allDocs);
    console.log(`Upload complete. Processed ${result.length} docs.`);
    const failed = result.filter((r) => r.error).length;
    if (failed > 0) {
      console.warn(`  ⚠️  ${failed} docs failed. Check the details above.`);
    } else {
      console.log('  ✓ All docs uploaded successfully.');
    }
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
