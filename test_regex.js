const fs = require('fs');
const content = fs.readFileSync('packages/core-api/src/externalApi.ts', 'utf8');

// print lines 265 to 360
console.log(content.split('\n').slice(264, 360).join('\n'));
