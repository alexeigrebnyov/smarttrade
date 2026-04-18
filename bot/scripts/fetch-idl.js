const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../contracts/target/idl/arb_bot.json');
const dstDir = path.resolve(__dirname, '../idl');
const dst = path.join(dstDir, 'arb_bot.json');

if (!fs.existsSync(src)) {
  console.error('IDL not found at', src, '\nRun: (cd ../../contracts && anchor build)');
  process.exit(1);
}
if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('IDL copied to bot/idl/arb_bot.json');
