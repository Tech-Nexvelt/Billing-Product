import fs from 'fs';

const content = fs.readFileSync('all_inputs.txt', 'utf8');
const lines = content.split('\n');

console.log('Total lines in all_inputs.txt:', lines.length);

let matches = 0;
lines.forEach((line, idx) => {
  if (line.includes('Starters') || line.includes('Mocktails') || line.includes('Hot Coffees') || line.includes('Frappes')) {
    matches++;
    if (matches < 30) {
      console.log(`Line ${idx+1}: ${line.trim()}`);
    }
  }
});

console.log('Total matches:', matches);
