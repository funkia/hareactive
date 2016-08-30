var Suite = require("./default-suite").Suite;
var most = require("most");
var B = require("../dist/Behavior");
var S = require("../dist/Stream");
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
        ev.publish(arr[i]);
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

module.exports = Suite("filter-map-reduce")

  .add("Stream", function(defered) {
    var ev = S.empty();
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
