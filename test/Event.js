var assert = require('assert');

var E = require('../src/event');

function id(v) {
  return v;
}

function isEven(n) {
  return n % 2 === 0;
}

function double(n) {
  return n * 2;
}

function add(x, y) {
  if (arguments.length === 1) {
    return function(y) { return x + y; };
  }
  return x + y;
}

describe('Event', function() {
  it('calls listeners', function() {
    var result = [];
    var e = E.Event();
    E.on(function(v) { result.push(v); }, e);
    e.push(1);
    e.push(2);
    e.push(3);
    assert.deepEqual(result, [1, 2, 3]);
  });
  it('has curried push function', function() {
    var e = E.Event();
    e.push(1);
    assert.equal(E.last(e), 1);
    E.push(e, 2);
    assert.equal(E.last(e), 2);
    E.push(e)(3);
    assert.equal(E.last(e), 3);
  });
  describe('concat', function() {
    it('calls listeners with events from both', function() {
      var result = [];
      var ev1 = E.Event();
      var ev2 = E.Event();
      var both = ev1.concat(ev2);
      E.on(function(v) { result.push(v); }, both);
      ev1.push(1);
      ev2.push(2);
      ev1.push(3);
      assert.deepEqual(result, [1, 2, 3]);
    });
    it('is associative', function() {
      var result1 = [];
      var result2 = [];
      var ev1 = E.Event();
      var ev2 = E.Event();
      var first = ev1.concat(ev2);
      var second = ev2.concat(ev1);
      E.on(function(v) { result1.push(v); }, first);
      E.on(function(v) { result2.push(v); }, second);
      ev1.push(1);
      ev2.push(2);
      ev1.push(3);
      ev2.push(4);
      assert.deepEqual(result1, [1, 2, 3, 4]);
      assert.deepEqual(result1, result2);
    });
  });
  describe('map', function() {
    it('maps values function', function() {
      var result = [];
      var ev = E.Event();
      var mapped = E.map(double, ev);
      E.on(function(v) { result.push(v); }, mapped);
      ev.push(1);
      ev.push(2);
      ev.push(3);
      assert.deepEqual(result, [2, 4, 6]);
    });
    it('maps values method', function() {
      var result = [];
      var ev = E.Event();
      var mapped = ev.map(double);
      E.on(function(v) { result.push(v); }, mapped);
      ev.push(1);
      ev.push(2);
      ev.push(3);
      assert.deepEqual(result, [2, 4, 6]);
    });
  });
  describe('ap', function() {
    it('applies event of functions to event of numbers', function() {
      var result = [];
      var fnE = E.Event();
      var numE = E.Event();
      var applied = E.ap(fnE, numE);
      E.on(function(v) { result.push(v); }, applied);
      fnE.push(add(1));
      numE.push(2);
      fnE.push(double);
      fnE.push(isEven);
      numE.push(7);
      fnE.push(double);
      assert.deepEqual(result, [3, 4, true, false, 14]);
    });
  });
  describe('of', function() {
    it('identity', function() {
      var result1 = [];
      var result2 = [];
      var numE = E.Event();
      var num2E = E.of(id).ap(numE);
      E.on(function(v) { result1.push(v); }, numE);
      E.on(function(v) { result2.push(v); }, numE);
      numE.push(1);
      numE.push(2);
      numE.push(3);
      assert.deepEqual(result1, [1, 2, 3]);
      assert.deepEqual(result1, result2);
    });
  });
  describe('chain', function() {
    it('resulting event emits from all', function() {
      var result = [];
      var e1 = E.Event();
      var e2 = E.Event();
      var e3 = E.Event();
      var chainedE = e1.chain(function(n) {
        return n === 2 ? e2 : e3;
      });
      E.map(function(n) {
        result.push(n);
      }, chainedE);
      E.push(e1, 2);
      E.push(e1, 3);
      E.push(e2, 1);
      E.push(e3, 2);
      E.push(e2, 3);
      assert.deepEqual(result, [1, 2, 3]);
    });
  });
  it('filters values', function() {
    var result = [];
    var ev = E.Event();
    var filtered = E.filter(isEven, ev);
    E.on(function(v) { result.push(v); }, filtered);
    ev.push(1);
    ev.push(2);
    ev.push(3);
    assert.deepEqual(result, [2]);
  });
  it('scans values', function() {
    var result = [];
    var ev = E.Event();
    var scanned = E.scan(add, 0, ev);
    E.on(function(v) { result.push(v); }, scanned);
    ev.push(1);
    ev.push(2);
    ev.push(3);
    assert.deepEqual(result, [1, 3, 6]);
  });
});
