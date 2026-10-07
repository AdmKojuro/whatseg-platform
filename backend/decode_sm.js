const { SourceMapConsumer } = require('source-map');
const fs = require('fs');

async function main() {
  const raw = fs.readFileSync('dist/src/external-api/external.controller.js.map', 'utf8');
  const sm = JSON.parse(raw);
  const consumer = await new SourceMapConsumer(sm);

  const lines = {};
  consumer.eachMapping(function(m) {
    if (lines[m.originalLine] === undefined) {
      lines[m.originalLine] = m.originalColumn;
    }
  });

  const lineNums = Object.keys(lines).map(Number).sort(function(a,b){return a-b});
  console.log('Total original lines mapped:', lineNums.length);
  console.log('Line range:', lineNums[0], '-', lineNums[lineNums.length-1]);

  // Also check the activaciones service source map
  const raw2 = fs.readFileSync('dist/src/modules/activaciones/activaciones.service.js.map', 'utf8');
  const sm2 = JSON.parse(raw2);
  const consumer2 = await new SourceMapConsumer(sm2);

  const lines2 = {};
  consumer2.eachMapping(function(m) {
    if (lines2[m.originalLine] === undefined) {
      lines2[m.originalLine] = m.originalColumn;
    }
  });

  const lineNums2 = Object.keys(lines2).map(Number).sort(function(a,b){return a-b});
  console.log('\nActivaciones service:');
  console.log('Total original lines mapped:', lineNums2.length);
  console.log('Line range:', lineNums2[0], '-', lineNums2[lineNums2.length-1]);

  consumer.destroy();
  consumer2.destroy();
}

main().catch(function(e) { console.error(e); });
