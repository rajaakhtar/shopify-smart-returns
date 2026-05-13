const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  open:      path.join(DATA_DIR, 'submissions.json'),
  processed: path.join(DATA_DIR, 'processed.json'),
  cancelled: path.join(DATA_DIR, 'cancelled.json'),
};

function readFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
}

function writeFile(filePath, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Only open (pending) submissions
function loadOpen() {
  return readFile(FILES.open);
}

// All records across all three files
function loadAll() {
  return [
    ...readFile(FILES.open),
    ...readFile(FILES.processed),
    ...readFile(FILES.cancelled),
  ];
}

// Save a brand-new submission to the open file
function saveNew(submission) {
  const items = readFile(FILES.open);
  items.unshift(submission);
  writeFile(FILES.open, items);
}

// Find a submission by id across all files; returns { submission, fileKey } or null
function findById(id) {
  for (const [fileKey, filePath] of Object.entries(FILES)) {
    const items = readFile(filePath);
    const submission = items.find(s => String(s.id) === String(id));
    if (submission) return { submission, fileKey };
  }
  return null;
}

// Update fields on a submission in whichever file it lives; returns updated record or null
function update(id, updates) {
  for (const filePath of Object.values(FILES)) {
    const items = readFile(filePath);
    const idx = items.findIndex(s => String(s.id) === String(id));
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates };
      writeFile(filePath, items);
      return items[idx];
    }
  }
  return null;
}

// Move a submission from the open file to processed or cancelled,
// optionally merging extra fields at the same time
function moveTo(id, targetStatus, updates = {}) {
  const openItems = readFile(FILES.open);
  const idx = openItems.findIndex(s => String(s.id) === String(id));
  if (idx === -1) return null;

  const [submission] = openItems.splice(idx, 1);
  const moved = { ...submission, ...updates, status: targetStatus };

  const targetFile = FILES[targetStatus];
  if (!targetFile) return null;

  const targetItems = readFile(targetFile);
  targetItems.unshift(moved);

  writeFile(FILES.open, openItems);
  writeFile(targetFile, targetItems);
  return moved;
}

module.exports = { FILES, loadOpen, loadAll, saveNew, findById, update, moveTo };
