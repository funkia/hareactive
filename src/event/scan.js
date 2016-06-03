var h = require('../frp-common.js');
var E = h.Event;

// Scan

function ScanBody(fn, acc, ev) {
  this.fn = fn;
  this.ev = ev;
}

ScanBody.prototype.run = function(v) {
  this.ev.push(this.fn(this.ev.last, v));
};

module.exports = function(fn, acc, srcE) {
  var scanE = E.Event();
  scanE.last = acc;
  scanE.body = new ScanBody(fn, acc, scanE);
  srcE.eventListeners.push(scanE);
  return scanE;
};
