var Suite = require("./default-suite").Suite;
var most = require("most");
var S = require("../dist/stream");
var B = require("../dist/behavior");
var Bo = require("./hareactive-old/dist/behavior");
var So = require("./hareactive-old/dist/stream");

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

function pushArray(arr, ev) {
  for (var i = 0; i < arr.length; ++i) {
    ev.push(arr[i]);
  }
}

module.exports = Suite("map-map-map-stream")

  .add("Stream old", function(defered) {
    var stream = So.empty();
    stream
      .map(add1).map(double).map(sub3)
      .subscribe(function(e) {
        if (e === result) {
          defered.resolve();
        }
      });
    pushArray(testData, stream);
  }, {defer: true})

  .add("Stream", function(defered) {
    var stream = S.sinkStream();
    stream
      .map(add1).map(double).map(sub3)
      .subscribe(function(e) {
        if (e === result) {
          defered.resolve();
        }
      });
    pushArray(testData, stream);
  }, {defer: true})

  .add("most", function(defered) {
    most
      .from(testData)
      .map(add1)
      .map(double)
      .map(sub3)
      .observe(function(e) {
        if (e === result) {
          defered.resolve();
        }
      });
  }, {defer: true})

  .run({"async": true});
