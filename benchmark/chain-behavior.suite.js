var Suite = require("./default-suite").Suite;
var most = require("most");
var S = require("../dist/stream");
var B = require("../dist/behavior");
var Bo = require("./hareactive-old/dist/behavior");
var So = require("./hareactive-old/dist/stream");

var n = 100000;

module.exports = Suite("chain-behavior")

  .add("Behavior old", function(defered) {
    var b1 = Bo.sinkBehavior(true);
    var b2 = Bo.sinkBehavior(1);
    var b3 = Bo.sinkBehavior(2);
    var b = b1.chain((b) => b ? b2 : b3);
    b.subscribe(function(e) {
      if (e === n - 1) {
        defered.resolve();
      }
    });
    for (var i = 0; i <= n; ++i) {
      switch (i % 4) {
      case 0:
        b1.push(false);
        break;
      case 1:
        b2.push(i);
        break;
      case 2:
        b1.push(true);
        break;
      case 3:
        b3.push(i);
        break;
      }
    }
  }, {defer: true})

  .add("Behavior", function(defered) {
    var b1 = B.sinkBehavior(true);
    var b2 = B.sinkBehavior(1);
    var b3 = B.sinkBehavior(2);
    var b = b1.chain((b) => b ? b2 : b3);
    b.subscribe(function(e) {
      if (e === n - 1) {
        defered.resolve();
      }
    });
    for (var i = 0; i <= n; ++i) {
      switch (i % 4) {
      case 0:
        b1.push(false);
        break;
      case 1:
        b2.push(i);
        break;
      case 2:
        b1.push(true);
        break;
      case 3:
        b3.push(i);
        break;
      }
    }
  }, {defer: true})

  .run({"async": true});
