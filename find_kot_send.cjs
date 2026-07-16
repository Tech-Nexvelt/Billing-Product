const fs = require('fs');

const content = fs.readFileSync('e:/Softwares/Billing Product/src/features/orders/pages/OrderPage.tsx', 'utf8');
const lines = content.split('\n');

console.log('Searching for KOT/Kitchen occurrences in OrderPage.tsx:');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('kitchen') || line.toLowerCase().includes('kot') || line.toLowerCase().includes('send')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
