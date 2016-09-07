var Suite = require("./default-suite").Suite;
var most = require("most");
var S = require("../dist/Stream");
var B = require("../dist/Behavior");
var Bo = require("./hareactive-old/dist/Behavior");
var So = require("./hareactive-old/dist/Stream");

var n = 100000;

module.exports = Suite("chain-behavior")

  .add("Old behavior", function(defered) {
    var b1 = Bo.sink(true);
    var b2 = Bo.sink(1);
    var b3 = Bo.sink(2);
    var b = b1.chain((b) => b ? b2 : b3);
    Bo.subscribe(function(e) {
      if (e === n - 1) {
        defered.resolve();
      }
    }, b);
    for (var i = 0; i <= n; ++i) {
      switch (i % 4) {
      case 0:
        b1.publish(false);
        break;
      case 1:
        b2.publish(i);
        break;
      case 2:
        b1.publish(true);
        break;
      case 3:
        b3.publish(i);
        break;
      }
    }
  }, {defer: true})

  .add("Behavior", function(defered) {
    var b1 = B.sink(true);
    var b2 = B.sink(1);
    var b3 = B.sink(2);
    var b = b1.chain((b) => b ? b2 : b3);
    B.subscribe(function(e) {
      if (e === n - 1) {
        defered.resolve();
      }
    }, b);
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
