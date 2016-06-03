var hare = require('../frp-common.js');
var E = hare.Event;
var Event = E.Event;

// Filter

function FilterBody(pred, ev) {
  this.pred = pred;
  this.ev = ev;
}

FilterBody.prototype.run = function(v) {
  if (this.pred(v) === true) {
    this.ev.push(v);
  }
};

E.filter = function(pred, srcEv) {
  var filterEv = new Event();
  filterEv.body = new FilterBody(pred, filterEv);
  srcEv.eventListeners.push(filterEv);
  return filterEv;
};

E.scan = require('./scan.js');

E.map = function(fn, srcEv) {
  return srcEv.map(fn);
};

E.ap = function(fnE, valE) {
  return fnE.ap(valE);
};

module.exports = E;
