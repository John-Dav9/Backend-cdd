const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIRS = new Set(['node_modules', '.git', '.github']);

function walk(dir, depth = 0) {
  if (depth > 5) return [];

  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(fullPath, depth + 1));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const preferredCandidates = [
  path.join(ROOT, 'dist', 'main.js'),
  path.join(ROOT, 'dist', 'src', 'main.js'),
  path.join(ROOT, 'main.js'),
];

const discoveredMainFiles = walk(ROOT)
  .filter((file) => file.endsWith(`${path.sep}main.js`) || path.basename(file) === 'main.js')
  .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));

const candidates = [...preferredCandidates, ...discoveredMainFiles];
const entry = candidates.find((file, index) => candidates.indexOf(file) === index && fs.existsSync(file));

if (!entry) {
  console.error('Nest build output not found. Checked:');
  for (const candidate of candidates) {
    console.error(`- ${candidate}`);
  }
  const distDir = path.join(ROOT, 'dist');
  console.error('Files inside dist (recursive):');
  for (const file of walk(distDir).sort()) {
    console.error(`- ${file}`);
  }
  console.error('Top-level entries:');
  try {
    for (const name of fs.readdirSync(ROOT)) {
      console.error(`- ${name}`);
    }
  } catch {}
  process.exit(1);
}

console.log(`Starting Nest app from: ${entry}`);
require(entry);
