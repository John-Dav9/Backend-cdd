const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, 'dist', 'main.js'),
  path.join(__dirname, 'dist', 'src', 'main.js'),
];

const entry = candidates.find((file) => fs.existsSync(file));

if (!entry) {
  console.error('Nest build output not found. Checked:');
  for (const candidate of candidates) {
    console.error(`- ${candidate}`);
  }
  process.exit(1);
}

require(entry);
