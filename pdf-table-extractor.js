// modify from https://github.com/mozilla/pdf.js/blob/master/examples/node/pdf2svg.js
pdf_table_extractor = function(doc){
  var numPages = doc.numPages;
  var result = {};
  result.pageTables = [];
  result.numPages = numPages;

  var lastPromise = Promise.resolve(); // will be used to chain promises
  var loadPage = function (pageNum) {
    return doc.getPage(pageNum).then(function (page) {
      var verticles = [];
      var horizons = [];
      var merges = {};
      var merge_alias = {};

      return page.getOperatorList().then(function (opList) {
              // Get rectangle first
              var showed = {};
              var REVOPS = [];
              for (var op in PDFJS.OPS) {
                  REVOPS[PDFJS.OPS[op]] = op;
              }

              var strokeRGBColor = null;
              var fillRGBColor = null;
              var current_x, current_y;
              var edges = [];

              while (opList.fnArray.length) {
                  var fn = opList.fnArray.shift();
                  var args = opList.argsArray.shift();
                  if (PDFJS.OPS.constructPath == fn) {
                      while (args[0].length) {
                          op = args[0].shift();
                          if (op == PDFJS.OPS.rectangle) {
                              x = args[1].shift();
                              y = args[1].shift();
                              width = args[1].shift();
                              height = args[1].shift();
                              if (Math.min(width, height) < 1) {
                                  edges.push({y:y, x:x, width:width, height:height});
                              }
                          } else if (op == PDFJS.OPS.moveTo) {
                              current_x = args[1].shift();
                              current_y = args[1].shift();
                          } else if (op == PDFJS.OPS.lineTo) {
                              x = args[1].shift();
                              y = args[1].shift();
                              current_x = x;
                              current_y = y;
                          } else {
                              // throw ('constructPath ' + op);
                          }
                      }
                  } else if (PDFJS.OPS.setStrokeRGBColor == fn) {
                      strokeRGBColor = args;
                  } else if (PDFJS.OPS.setFillRGBColor == fn) {
                      fillRGBColor = args;
                  } else if (PDFJS.OPS.setLineWidth == fn) {
                      lineWidth = args;
                  } else if (['eoFill'].indexOf(REVOPS[fn]) >= 0) {
                  } else if ('undefined' === typeof(showed[fn])) {
                      showed[fn] = REVOPS[fn];
                  } else {
                  }
              }

              // merge rectangle to verticle lines and horizon lines
              edges1 = JSON.parse(JSON.stringify(edges));
              edges1.sort(function(a, b){ return (a.x - b.x) || (a.y - b.y); });
              edges2 = JSON.parse(JSON.stringify(edges));
              edges2.sort(function(a, b){ return (a.y - b.y) || (a.x - b.x); });

              // get verticle lines
              var current_x = null;
              var current_y = null;
              var current_height = 0;
              var lines = [];
              while (edge = edges1.shift()) {
                  if (edge.width > 1) {
                      continue;
                  }
                  if (null === current_x || current_x != edge.x) {
                      if (current_height > 1) {
                          lines.push({top: current_y, bottom: current_y + current_height});
                      }
                      if (null !== current_x && lines.length) {
                          verticles.push({x: current_x, lines: lines});
                      }
                      current_x = edge.x;
                      current_y = edge.y;
                      current_height = 0;
                      lines = [];
                  }

                  if (Math.abs(current_y + current_height - edge.y) < 10) {
                      current_height = edge.height + edge.y - current_y;
                  } else {
                      if (current_height > 1) {
                          lines.push({top: current_y, bottom: current_y + current_height});
                      }
                      current_y = edge.y;
                      current_height = edge.height;
                  }
              }
              if (current_height > 1) {
                  lines.push({top: current_y, bottom: current_y + current_height});
              }
              verticles.push({x: current_x, lines: lines});

              // Get horizon lines
              current_x = null;
              current_y = null;
              var current_width = 0;
              while (edge = edges2.shift()) {
                  if (edge.height > 1) {
                      continue;
                  }
                  if (null === current_y || current_y != edge.y) {
                      if (current_width > 1) {
                          lines.push({left: current_x, right: current_x + current_width});
                      }
                      if (null !== current_y && lines.length) {
                          horizons.push({y: current_y, lines: lines});
                      }
                      current_x = edge.x;
                      current_y = edge.y;
                      current_width = 0;
                      lines = [];
                  }

                  if (Math.abs(current_x + current_width - edge.x) < 10) {
                      current_width = edge.width + edge.x - current_x;
                  } else {
                      if (current_width > 1) {
                          lines.push({left: current_x, right: current_x + current_width});
                      }
                      current_x = edge.x;
                      current_width = edge.width;
                  }
              }
              if (current_width > 1) {
                  lines.push({left: current_x, right: current_x + current_width});
              }
              horizons.push({y: current_y, lines: lines});

              var search_index = function(v, list) {
                  for (var i = 0; i < list.length; i ++) {
                      if (Math.abs(list[i] - v) < 5) {
                          return i;
                      }
                  }
                  return -1;
              };

              // handle merge cells
              x_list = verticles.map(function(a){ return a.x; });

              var verticle_merges = {};
              // skip the 1st lines and final lines
              for (var r = 0; r < horizons.length - 2; r ++) {
                  hor = horizons[horizons.length - r - 2];
                  lines = hor.lines.slice(0);
                  col = search_index(lines[0].left, x_list);
                  if (col != 0) {
                      for (var c = 0; c < col; c ++) {
                          verticle_merges[[r, c].join('-')] = {row: r, col: c, width: 1, height: 2};
                      }
                  }
                  while (line = lines.shift()) {
                      left_col = search_index(line.left, x_list);
                      right_col = search_index(line.right, x_list);
                      if (left_col != col) {
                          for (var c = col; c < left_col; c ++) {
                              verticle_merges[[r, c].join('-')] = {row: r, col: c, width: 1, height: 2};
                          }
                      }
                      col = right_col;
                  }
                  if (col != verticles.length - 1) {
                      for (var c = col; c < verticles.length - 1; c ++) {
                          verticle_merges[[r, c].join('-')] = {row: r, col: c, width: 1, height: 2};
                      }
                  }
              }

              while (true) {
                  var merged = false;
                  for (var r_c in verticle_merges) {
                      var m = verticle_merges[r_c];
                      var final_id = [m.row + m.height - 1, m.col + m.width - 1].join('-');
                      if ('undefined' !== typeof(verticle_merges[final_id])) {
                          verticle_merges[r_c].height += verticle_merges[final_id].height - 1;
                          delete(verticle_merges[final_id]);
                          merged = true;
                          break;
                      }
                  }
                  if (!merged) {
                      break;
                  }
              }

              var horizon_merges = {};
              y_list = horizons.map(function(a){ return a.y; }).sort(function(a, b) { return b - a; });
              for (var c = 0; c < verticles.length - 2; c ++) {
                  ver = verticles[c + 1];
                  lines = ver.lines.slice(0);
                  row = search_index(lines[0].bottom, y_list);
                  if (row != 0) {
                      for (var r = 0; r < row; r ++) {
                          horizon_merges[[r, c].join('-')] = {row: r, col: c, width: 2, height: 1};
                      }
                  }
                  while (line = lines.shift()) {
                      top_row = search_index(line.top, y_list);
                      bottom_row = search_index(line.bottom, y_list);
                      if (bottom_row != row) {
                          for (var r = bottom_row; r < row; r ++) {
                              horizon_merges[[r, c].join('-')] = {row: r, col: c, width: 2, height: 1};
                          }
                      }
                      row = top_row;
                  }
                  if (row != horizons.length - 1) {
                      for (var r = row; r < horizons.length - 1; r ++) {
                          horizon_merges[[r, c].join('-')] = {row: r, col: c, width: 2, height: 1};
                      }
                  }
              }

              while (true) {
                  var merged = false;
                  for (var r_c in horizon_merges) {
                      var m = horizon_merges[r_c];
                      var final_id = [m.row + m.height - 1, m.col + m.width - 1].join('-');
                      if ('undefined' !== typeof(horizon_merges[final_id])) {
                          horizon_merges[r_c].width += horizon_merges[final_id].width - 1;
                          delete(horizon_merges[final_id]);
                          merged = true;
                          break;
                      }
                  }
                  if (!merged) {
                      break;
                  }
              }
              merges = verticle_merges;
              for (var id in horizon_merges) {
                  if ('undefined' !== typeof(merges[id])) {
                      merges[id].width = horizon_merges[id].width;
                  } else {
                      merges[id] = horizon_merges[id];
                  }
              }
              for (var id in merges) {
                      for (var c = 0; c < merges[id].width; c ++) {
                          for (var r = 0; r < merges[id].height; r ++) {
                              if (c == 0 && r == 0) {
                                  continue;
                              }
                              delete(merges[[r + merges[id].row, c + merges[id].col].join('-')]);
                          }
                      }
              }

              merge_alias = {};
              for (var id in merges) {
                  for (var c = 0; c < merges[id].width; c ++) {
                      for (var r = 0; r < merges[id].height; r ++) {
                          if (r == 0 && c == 0) {
                              continue;
                          }
                          merge_alias[[merges[id].row + r, merges[id].col + c].join('-')] = [merges[id].row, merges[id].col].join('-');
                      }
                  }
              }
      }).then(function(){
          return page.getTextContent().then(function (content) {
                tables = [];
                for (var i = 0; i < horizons.length - 1; i ++) {
                    tables[i] = [];
                    for (var j = 0; j < verticles.length - 1; j ++) {
                        tables[i][j] = '';
                    }
                }
                while (item = content.items.shift()) {
                    x = item.transform[4];
                    y = item.transform[5];

                      var col = -1;
                      for (var i = 0; i < verticles.length - 1 ; i ++)  {
                          if (x >= verticles[i].x && x < verticles[i + 1].x) {
                              col = i;
                              break;
                          }
                      }
                      if (col == -1) {
                          continue;
                      }
                      var row = -1;
                      for (var i = 0; i < horizons.length - 1 ; i ++)  {
                          if (y >= horizons[i].y && y < horizons[i + 1].y) {
                              row = horizons.length - i - 2;
                              break;
                          }
                      }
                      if (row == -1) {
                          continue;
                      }

                      if ('undefined' !== typeof(merge_alias[row + '-' + col])) {
                          id = merge_alias[row + '-' + col];
                          row = id.split('-')[0];
                          col = id.split('-')[1];
                      }
                      // TODO: newline
                      tables[row][col] += item.str;
                  }
                if (tables.length) {
                    result.pageTables.push({
                            page: pageNum,
                            tables: tables,
                            merges: merges,
                            merge_alias: merge_alias,
                            width: verticles.length - 1,
                            height: horizons.length - 1,
                    });
                }
          });
      });
    });
  };

  for (var i = 1; i <= numPages; i++) {
    lastPromise = lastPromise.then(loadPage.bind(null, i));
  }
  return lastPromise.then(function(){
          return result;
  });
};
