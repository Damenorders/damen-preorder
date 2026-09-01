// One-off: export every valid pallet location from rack-locator.js for sticker printing.
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'public', 'warehouse', 'rack-locator.js');
const src = fs.readFileSync(srcPath, 'utf8');

// Pull the block that defines every warehouse's valid-location list, then eval it
// so we reuse the app's exact generation logic (no risk of drift).
const start = src.indexOf('const LEVEL_ORDER');
const endMarker = 'const FRIDGE60_LAYOUT = buildLayout(FRIDGE60_RACK_IDS, FRIDGE60_VALID_LOCATIONS);';
const end = src.indexOf(endMarker) + endMarker.length;
const block = src.slice(start, end);

// Pull out the per-warehouse rack lists, layouts, and the depth-suffix helper.
const env = eval(block + '\n({' +
  'depthSuffixes,' +
  'warehouses:[' +
    '{name:"Dry Products",rackIds:DRY_RACK_IDS,layout:DRY_LAYOUT},' +
    '{name:"Freezer",rackIds:FREEZER_RACK_IDS,layout:FREEZER_LAYOUT},' +
    '{name:"Fridge 40",rackIds:FRIDGE_RACK_IDS,layout:FRIDGE_LAYOUT},' +
    '{name:"Fridge 50",rackIds:FRIDGE50_RACK_IDS,layout:FRIDGE50_LAYOUT},' +
    '{name:"Fridge 60",rackIds:FRIDGE60_RACK_IDS,layout:FRIDGE60_LAYOUT}' +
  ']' +
'})');

// Build a FULL grid per rack: every level present runs positions 1..rack's max
// position, even if some positions aren't in use today — so stickers are ready
// for locations added later. Deep racks keep their front/rear suffixes (a/b/c),
// one sticker per physical pallet.
function fullGrid(rackIds, layout, depthSuffixes) {
  const codes = [];
  rackIds.slice().sort((a, b) => a - b).forEach(id => {
    const l = layout[id];
    if (!l) return;
    const levels = l.levelsOrder.slice().reverse(); // A -> E ascending
    const suffixes = depthSuffixes(id);
    levels.forEach(level => {
      for (let p = 1; p <= l.maxPos; p++) {
        suffixes.forEach(s => codes.push(id + '-' + level + '-' + p + s));
      }
    });
  });
  return codes;
}

let total = 0;
let csv = 'Warehouse,Location\n';
let txt = '';
for (const wh of env.warehouses) {
  const list = fullGrid(wh.rackIds, wh.layout, env.depthSuffixes);
  txt += `=== ${wh.name} (${list.length}) ===\n`;
  for (const code of list) { csv += `${wh.name},${code}\n`; txt += code + '\n'; total++; }
  txt += '\n';
}
const out = {}; // (kept for the summary loop below)
for (const wh of env.warehouses) out[wh.name] = fullGrid(wh.rackIds, wh.layout, env.depthSuffixes);

fs.writeFileSync(path.join(__dirname, '..', 'warehouse-locations.csv'), csv);
fs.writeFileSync(path.join(__dirname, '..', 'warehouse-locations.txt'), txt);

console.log('TOTAL PALLET LOCATIONS: ' + total);
for (const [name, list] of Object.entries(out)) console.log('  ' + name + ': ' + list.length);
