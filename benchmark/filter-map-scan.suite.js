var Suite = require("./default-suite").Suite;
var most = require("most");
var B = require("../dist/behavior");
var S = require("../dist/stream");
var Bo = require("./hareactive-old/dist/behavior");
var So = require("./hareactive-old/dist/stream");

var n = 1000000;
var a = new Array(n);
var result = 0;

for (var i = 0; i < a.length; ++i) {
  a[i] = i;
  if (even(i)) {
    result += add1(i);
  }
}

function pushArray(arr, ev) {
  for (var i = 0; i < arr.length; ++i) {
    ev.push(arr[i]);
  }
}

function sum(c, b) {
    return c + b;
}
function add1(x) {
    return x + 1;
}
function even(x) {
    return x % 2 === 0;
}

module.exports = Suite("filter-map-scan")

  .add("Stream old", function(defered) {
    var ev = So.empty();
    Bo.at(
      So.filter(even, ev).map(add1).scanS(sum, 0)
    ).subscribe(function(v) {
      if (v === result) {
        defered.resolve();
      }
    });
    pushArray(a, ev);
  }, { defer: true })

  .add("Stream", function(defered) {
    var ev = S.sinkStream();
    B.at(
      S.filter(even, ev).map(add1).scanS(sum, 0)
    ).subscribe(function(v) {
      if (v === result) {
        defered.resolve();
      }
    });
    pushArray(a, ev);
  }, { defer: true })

  .add("most", function(defered) {
    most
      .from(a)
      .filter(even)
      .map(add1)
      .scan(sum, 0)
      .observe(function(v) {
        if (v === result) {
          defered.resolve();
        }
      });
  }, { defer: true })

  .run({ async: true });
