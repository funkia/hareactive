var assert = require('assert');

var E = require('../src/event');
var B = require('../src/behaviour');

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

describe('Behavior', function() {
  it('pulls constant function', function() {
    var b = B.BehaviorK(0);
    assert.equal(B.at(b), 0);
    b.push(1);
    assert.equal(B.at(b), 1);
    b.push(2);
    assert.equal(B.at(b), 2);
    b.push(3);
    assert.equal(B.at(b), 3);
  });
  it('pushes from time varying functions', function() {
    var time = 0;
    var b = B.Behavior(function() {
      return time;
    });
    assert.equal(B.at(b), 0);
    time = 1;
    assert.equal(B.at(b), 1);
    time = 2;
    assert.equal(B.at(b), 2);
    time = 3;
    assert.equal(B.at(b), 3);
  });
  it('allows listening on discretely changes', function() {
    var b = B.BehaviorK(0);
    var result = [];
    B.on(function(v) { result.push(v); }, b);
    b.push(1);
    b.push(2);
    b.push(3);
    assert.deepEqual(result, [0,1,2,3]);
  });
  describe('concat', function() {
    function mAdd(m) {
      return mNumber(this.n + m.n);
    }
    function mNumber(n) {
      return {n: n, concat: mAdd};
    }
    it('appends values from behaviors with push', function() {
      var nB = B.BehaviorK(mNumber(1));
      var mB = B.BehaviorK(mNumber(2));
      var nmB = nB.concat(mB);
      assert.equal(B.at(nmB).n, 3);
      nB.push(mNumber(3));
      assert.equal(B.at(nmB).n, 5);
      mB.push(mNumber(5));
      assert.equal(B.at(nmB).n, 8);
    });
    it('appends values from behaviors with pull', function() {
      var n = 1, m = 3;
      var nB = B.Behavior(function() {
        return mNumber(n);
      });
      var mB = B.BehaviorK(mNumber(4));
      var nmB = nB.concat(mB);
      assert.equal(B.at(nmB).n, 5);
      n = 2;
      assert.equal(B.at(nmB).n, 6);
      B.set(mB, function() {
        return mNumber(m);
      });
      assert.equal(B.at(nmB).n, 5);
      m = 4;
      assert.equal(B.at(nmB).n, 6);
      nB.push(mNumber(0));
      assert.equal(B.at(nmB).n, 4);
    });
  });
  describe('map', function() {
    it('maps constant function', function() {
      var b = B.BehaviorK(0);
      var mapped = B.map(double, b);
      assert.equal(B.at(b), 0);
      B.push(b, 1);
      assert.equal(B.at(mapped), 2);
      B.push(b, 2);
      assert.equal(B.at(mapped), 4);
      B.push(b, 3);
      assert.equal(B.at(mapped), 6);
    });
    it('maps values method', function() {
      var b = B.Behavior();
      var mapped = b.map(double);
      b.push(1);
      assert.equal(B.at(mapped), 2);
      b.push(2);
      assert.equal(B.at(mapped), 4);
      b.push(3);
      assert.equal(B.at(mapped), 6);
    });
    it('maps time function', function() {
      var time = 0;
      var b = B.Behavior(function() {
        return time;
      });
      var mapped = B.map(double, b);
      assert.equal(B.at(mapped), 0);
      time = 1;
      assert.equal(B.at(mapped), 2);
      time = 2;
      assert.equal(B.at(mapped), 4);
      time = 3;
      assert.equal(B.at(mapped), 6);
    });
  });
  describe('ap', function() {
    it('applies event of functions to event of numbers with push', function() {
      var result = [];
      var fnB = B.BehaviorK(add(1));
      var numE = B.BehaviorK(3);
      var applied = B.ap(fnB, numE);
      assert.equal(B.at(applied), 4);
      fnB.push(add(2));
      assert.equal(B.at(applied), 5);
      fnB.push(double);
      assert.equal(B.at(applied), 6);
      fnB.push(isEven);
      assert.equal(B.at(applied), false);
      numE.push(8);
      assert.equal(B.at(applied), true);
      fnB.push(double);
      assert.equal(B.at(applied), 16);
    });
    it('applies event of functions to event of numbers with pull', function() {
      var number = 1;
      var fnB = B.BehaviorK(add(5));
      var numE = B.Behavior(function() {
        return number;
      });
      var applied = E.ap(fnB, numE);
      assert.equal(B.at(applied), 6);
      fnB.push(add(2));
      assert.equal(B.at(applied), 3);
      number = 4;
      assert.equal(B.at(applied), 6);
      fnB.push(double);
      assert.equal(B.at(applied), 8);
      number = 8;
      assert.equal(B.at(applied), 16);
    });
    it('automatically lift constants', function() {
      var result = [];
      var fnB = B.BehaviorK(add(1));
      var applied = B.ap(fnB, 3);
      assert.equal(B.at(applied), 4);
    });
  });
  describe('of', function() {
    it('identity', function() {
      var result1 = [];
      var result2 = [];
      var numB = B.BehaviorK(0);
      var num2B = B.of(id).ap(numB);
      numB.push(1);
      assert.equal(B.at(numB), 1);
      assert.equal(B.at(num2B), 1);
      numB.push(2);
      assert.equal(B.at(numB), 2);
      assert.equal(B.at(num2B), 2);
      numB.push(3);
      assert.equal(B.at(numB), 3);
      assert.equal(B.at(num2B), 3);
    });
  });
  it('can switch from constant to varying and back', function() {
    var time = 0;
    var b = B.BehaviorK(0);
    var mapped = B.map(double, b);
    assert.equal(B.at(mapped), 0);
    B.set(b, function() {
      return time;
    });
    assert.equal(B.at(mapped), 0);
    time = 2;
    assert.equal(B.at(mapped), 4);
    B.push(b, 4);
    assert.equal(B.at(mapped), 8);
  });
  describe('scan', function() {
    it('begins with initial value', function() {
      var e = E.scan(function() {}, 0, E.Event());
      assert.equal(E.last(e), 0);
    });
  });
  describe('stepper', function() {
    it('steps to the last event value', function() {
      var e = E.Event();
      var b = B.stepper(0, e);
      assert.equal(B.at(b), 0);
      e.push(1);
      assert.equal(B.at(b), 1);
      e.push(2);
      assert.equal(B.at(b), 2);
    });
  });
});
