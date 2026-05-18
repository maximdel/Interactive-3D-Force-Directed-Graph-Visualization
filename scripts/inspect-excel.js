const XLSX = require('xlsx');
const path = require('path');

function inspectSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const first = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: null });

  console.log(`\n=== ${path.basename(filePath)} ===`);
  console.log(`Rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log(`Columns: ${Object.keys(rows[0]).join(', ')}`);
    console.log(`\nFirst row (sample):`, JSON.stringify(rows[0], null, 2));
  }
}

try {
  inspectSheet('cordis-HORIZONprojects-xlsx/project.xlsx');
  inspectSheet('cordis-HORIZONprojects-xlsx/organization.xlsx');
  inspectSheet('cordis-HORIZONprojects-xlsx/topics.xlsx');
} catch (err) {
  console.error('Error:', err.message);
}
