var Suite = require("./default-suite");
var most = require("most");
var $ = require("../src/Events.js");
var $_old = require("../src/Events_old.js");

var Events = $.Events;

var n  = 1000000;
var a = new Array(n);
for (var i = 0; i < a.length; ++i) {
  a[i] = i;
}

function pushArray(arr, ev) {
  for (var i = 0; i < arr.length; ++i) {
    ev.publish(arr[i]);
  }
}

function sum(a, b) {
  return a + b;
}

function add1(x) {
	return x + 1;
}

function even(x) {
	return x % 2 === 0;
}

Suite("filter-map-reduce")

  .add('Events', function(defered) {
    var ev = new Events();
    $.scan(sum, 0, $.map(add1, $.filter(even, ev)));
    pushArray(a, ev);
    defered.resolve();
  }, {defer: true})

  .add('Events_old', function(defered) {
    var ev = new Events();
    $_old.scan(sum, 0, $_old.map(add1, $_old.filter(even, ev)));
    pushArray(a, ev);
    defered.resolve();
  }, {defer: true})

  .add("most", function(defered) {
    most
      .from(a)
      .filter(even)
      .map(add1)
      .reduce(sum, 0)
      .then(function() {
        defered.resolve();
      });
  }, {defer: true})
  .run({async: true});
