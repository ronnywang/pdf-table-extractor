// Ex: node parse-cmd.js samples/pta_10229_131308_94274.pdf

var fs = require('fs');

const canvas = require('canvas');
global.DOMMatrix = canvas.DOMMatrix;
global.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
pdfjsLib.cMapUrl = 'pdfjs-dist/cmaps/';
pdfjsLib.cMapPacked = true;

require('./pdf-table-extractor.js');


// Loading file from file system into typed array
var pdfPath = process.argv[2];
var data = new Uint8Array(fs.readFileSync(pdfPath));

// Will be using promises to load document, pages and misc data instead of
// callback.
pdfjsLib.getDocument(data).promise.then(pdf_table_extractor).then(function (result) {
    console.log(JSON.stringify(result));
    // fs.writeFileSync('output.json', JSON.stringify(result));
}, function (err) {
    console.error('Error: ' + err, err.stack);
});

