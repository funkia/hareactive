var Suite = require("./default-suite").Suite;
var most = require("most");
var $ = require("../dist/Events.js");

var n = 100000;
var testData = [];
var result = 0;

for (var i = 0; i < n; i++) {
    testData[i] = i;
    result += i;
}

function sum(curr, val) {
    return curr + val;
}

module.exports = Suite("Scan")

  .add("Events", function (defered) {
    var j = $.empty();
    var s = $.scan(sum, 0, j);
    $.subscribe(function (e) {
      if (e === result) {
        defered.resolve();
      }
    }, s);
    var i = 0;
    var l = testData.length;
    for (; i < l; i++) {
      $.publish(testData[i], j);
    }
  }, { defer: true })

  .add("most", function (defered) {
    most.create(function (add) {
      var i = 0;
      var l = testData.length;
      for (; i < l; i++) {
        add(testData[i]);
      }
    }).scan(sum, 0)
      .observe(function (e) {
        if (e === result) {
          defered.resolve();
        }
      });
  }, { defer: true })

  .run({ "async": true });
