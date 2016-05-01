// Ex: node parse-cmd.js samples/pta_10229_131308_94274.pdf

var fs = require('fs');
Image = function(){ };

// HACK few hacks to let PDF.js be loaded not as a module in global space.
require('./pdf.js/examples/node/domstubs.js');
require('./pdf-table-extractor.js');

// Run `gulp dist` to generate 'pdfjs-dist' npm package files.
PDFJS = require('./pdf.js/build/dist');
PDFJS.cMapUrl = './pdf.js/build/generic/web/cmaps/';
PDFJS.cMapPacked = true;


// Loading file from file system into typed array
var pdfPath = process.argv[2];
var data = new Uint8Array(fs.readFileSync(pdfPath));

// Will be using promises to load document, pages and misc data instead of
// callback.
PDFJS.getDocument(data).then(pdf_table_extractor).then(function (result) {
    console.log(JSON.stringify(result));
}, function (err) {
    console.error('Error: ' + err);
});

