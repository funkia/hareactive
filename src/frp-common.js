function Event() {
  this.cbListeners = [];
  this.eventListeners = [];
  this.last = undefined;
  this.body = undefined;
}

Event.prototype.push = function(val) {
  var i; this.last = val;
  for (i = 0; i < this.cbListeners.length; ++i) {
    this.cbListeners[i](val);
  }
  for (i = 0; i < this.eventListeners.length; ++i) {
    this.eventListeners[i].body.run(val);
  }
};

Event.prototype.empty = function() {
  return new Event();
};

Event.prototype.concat = function(otherE) {
  var newE = new Event();
  newE.body = new NoopBody(newE);
  this.eventListeners.push(newE);
  otherE.eventListeners.push(newE);
  return newE;
};

Event.prototype.map = function(fn) {
  var newE = new Event();
  newE.body = new MapBody(fn, newE, this);
  this.eventListeners.push(newE);
  return newE;
};

Event.prototype.ap = function(valE) {
  var newE = new Event();
  newE.body = new ApBody(this, valE, newE);
  this.eventListeners.push(newE);
  valE.eventListeners.push(newE);
  return newE;
};

Event.prototype.of = function(val) {
  var newE = new Event();
  newE.last = val;
  return newE;
};

Event.prototype.chain = function(fn) {
  var outE = new Event();
  outE.body = new NoopBody(outE);
  var recieveE = new Event();
  recieveE.body = new ChainBody(this, fn, outE);
  this.eventListeners.push(recieveE);
  return outE;
};

// Noop body

function NoopBody(srcEv) {
  this.ev = srcEv;
}

NoopBody.prototype.run = function(v) {
  this.ev.push(v);
};

// Map body

function MapBody(fn, ownE, srcE) {
  this.fn = fn;
  this.ev = ownE;
  this.srcE = srcE;
}

MapBody.prototype.run = function(v) {
  this.ev.push(this.fn(v));
};

MapBody.prototype.pull = function() {
  return this.fn(this.srcE.last !== undefined ? this.srcE.last : this.srcE.body.pull());
};

// Apply body

function ApBody(fnE, valE, ev) {
  this.fnE = fnE;
  this.valE = valE;
  this.ev = ev;
}

ApBody.prototype.run = function(v) {
  var fn = this.fnE.last, val = this.valE.last;
  if (fn !== undefined && val !== undefined) {
    this.ev.push(fn(val));
  }
};

ApBody.prototype.pull = function() {
  return at(this.fnE)(at(this.valE));
};

// Chain body

function ChainBody(srcE, fn, e) {
  this.srcE = srcE;
  this.fn = fn;
  this.e = e;
}

ChainBody.prototype.run = function(v) {
  var newE = this.fn(v);
  newE.eventListeners.push(this.e);
};

// Concat body – only used by behaviors

function ConcatBody(fstB, sndB, b) {
  this.fstB = fstB;
  this.sndB = sndB;
  this.b = b;
}

ConcatBody.prototype.run = function(v) {
  var fst = this.fstB.last, snd = this.sndB.last;
  if (fst !== undefined && snd !== undefined) {
    this.b.push(fst.concat(snd));
  }
};

ConcatBody.prototype.pull = function() {
  return at(this.fstB).concat(at(this.sndB));
};

function Behavior(fn, k) {
  this.cbListeners = [];
  this.eventListeners = [];
  this.last = k;
  this.body = new PullBody(this, fn);
}

function at(b) {
  return b.last !== undefined ? b.last : b.body.pull();
}

Behavior.prototype.push = Event.prototype.push;

Behavior.prototype.clear = function() {
  if (this.last !== undefined) {
    var i; this.last = undefined;
    for (i = 0; i < this.eventListeners.length; ++i) {
      this.eventListeners[i].clear();
    }
  }
};

Behavior.prototype.map = function(fn) {
  var newB = new Behavior(this.last !== undefined ? fn(this.last) : undefined);
  newB.body = new MapBody(fn, newB, this);
  this.eventListeners.push(newB);
  return newB;
};

Behavior.prototype.ap = function(valB) {
  if (!(valB instanceof Behavior)) valB = new Behavior(undefined, valB);
  var fn = this.last, val = valB.last;
  var newB = new Behavior(undefined, fn !== undefined && val !== undefined ? fn(val) : undefined);
  newB.body = new ApBody(this, valB, newB);
  this.eventListeners.push(newB);
  valB.eventListeners.push(newB);
  return newB;
};

Behavior.prototype.of = function(val) {
  return new Behavior(undefined, val);
};

Behavior.prototype.concat = function(b) {
  var fst = this.last, snd = b.last;
  var newB = new Behavior(undefined, fst !== undefined && snd !== undefined ? fst.concat(snd) : undefined);
  newB.body = new ConcatBody(this, b, newB);
  this.eventListeners.push(newB);
  b.eventListeners.push(newB);
  return newB;
};

// Pull body

function PullBody(b, fn) {
  this.b = b;
  this.fn = fn;
}

PullBody.prototype.run = function(v) {
  this.b.push(v);
};

PullBody.prototype.pull = function() {
  return this.fn();
};

function pushFn(targ, v) {
  return arguments.length === 1 ? function(v) { targ.push(v); }
                                : targ.push(v);
}

function mapFn(fn, e) {
  return e.map(fn);
}

function on(f, e) {
  e.cbListeners.push(f)
}

module.exports = {
  Behavior: {
    Behavior: function(fn) {
      return new Behavior(fn, undefined);
    },
    BehaviorK: function(v) {
      return new Behavior(undefined, v);
    },
    of: Behavior.prototype.of,
    set: function(b, fn) {
      b.clear();
      b.body.fn = fn;
    },
    at: at,
    map: mapFn,
    on: function(f, b) {
      b.cbListeners.push(f);
      f(at(b));
    },
    push: pushFn,
  },
  Event: {
    Event: function() { return new Event(); },
    of: Event.prototype.of,
    push: pushFn,
    last: function(e) {
      return e.last;
    },
    map: mapFn,
    on: on,
  },
};
