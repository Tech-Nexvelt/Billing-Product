import fs from 'fs';
import readline from 'readline';

async function searchTranscript() {
  const fileStream = fs.createReadStream('C:/Users/chkis/.gemini/antigravity/brain/b3f46ea4-8363-43a2-a2ad-2286d4d10801/.system_generated/logs/transcript.jsonl');
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let output = '';
  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.source === 'USER_EXPLICIT' && data.type === 'USER_INPUT') {
        output += `\n\n==================================================\n`;
        output += `STEP: ${data.step_index} | DATE: ${data.created_at}\n`;
        output += `==================================================\n`;
        output += data.content;
      }
    } catch (e) {
      // ignore parsing error for malformed lines if any
    }
  }
  fs.writeFileSync('all_inputs.txt', output);
  console.log('Saved all inputs to all_inputs.txt');
}

searchTranscript().catch(console.error);
