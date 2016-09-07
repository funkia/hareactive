var Suite = require("./default-suite").Suite;
var most = require("most");
var S = require("../dist/Stream");
var B = require("../dist/Behavior");
var Bo = require("./hareactive-old/dist/Behavior");
var So = require("./hareactive-old/dist/Stream");

var n = 100000;
var testData = [];

for (var i = 0; i < n; i++) {
  testData[i] = i;
}

function add1(n) {
  return n + 1;
}

function double(n) {
  return n * 2;
}

function sub3(n) {
  return n - 3;
}

var result = sub3(double(add1(n - 1)));

function pushArray(arr, b) {
  for (var i = 0; i < arr.length; ++i) {
    b.publish(arr[i]);
  }
}

module.exports = Suite("map-map-map-behavior")

  .add("Behavior old", function(defered) {
    var b = Bo.sink();
    B.subscribe(function(e) {
      if (e === result) {
        defered.resolve();
      }
    }, b.map(add1).map(double).map(sub3));
    pushArray(testData, b);
  }, {defer: true})

  .add("Behavior", function(defered) {
    var b = B.sink();
    B.subscribe(function(e) {
      if (e === result) {
        defered.resolve();
      }
    }, b.map(add1).map(double).map(sub3));
    pushArray(testData, b);
  }, {defer: true})

  .run({"async": true});
