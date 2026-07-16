const fs = require('fs');
const path = require('path');

const searchDir = 'e:/Softwares/Billing Product/src';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('printKot') || content.includes('printBill') || content.includes('printReceipts')) {
          console.log(`Match in: ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('printKot') || line.includes('printBill') || line.includes('printReceipts')) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  }
}

searchFiles(searchDir);
console.log('Search complete.');
