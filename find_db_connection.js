import fs from 'fs';
import path from 'path';

const rootDir = 'e:/Softwares/Billing Product';

function search(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (item !== 'node_modules' && item !== '.git' && item !== 'dist') {
        search(fullPath);
      }
    } else {
      if (item.endsWith('.ts') || item.endsWith('.json') || item.endsWith('.sql') || item.endsWith('.js') || item === '.env') {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('postgresql://') || content.includes('postgres://') || content.includes('DATABASE_URL')) {
          console.log(`Found in: ${fullPath}`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('postgresql://') || line.includes('postgres://') || line.includes('DATABASE_URL')) {
              console.log(`  L${idx+1}: ${line.trim().slice(0, 100)}`);
            }
          });
        }
      }
    }
  }
}

search(rootDir);
console.log('Search finished.');
