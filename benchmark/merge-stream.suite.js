var Suite = require("./default-suite").Suite;
var most = require("most");
var B = require("../dist/Behavior");
var S = require("../dist/Stream");
var Bo = require("./hareactive-old/dist/Behavior");
var So = require("./hareactive-old/dist/Stream");

var n = 1000000;
var a = new Array(n);
var result = 0;

for (var i = 0; i < a.length; ++i) {
  a[i] = i;
}

module.exports = Suite("merge-stream")

  .add("Stream old", function(defered) {
    var s1 = So.empty();
    var s2 = So.empty();
    var s3 = So.empty();
    var s4 = So.empty();
    s1.merge(s2).merge(s3).merge(s4)
      .subscribe(function(v) {
        if (v === n - 1) {
          defered.resolve();
        }
      });
    for (var i = 0; i < a.length; ++i) {
      switch (i % 4) {
      case 0:
        s1.push(a[i]);
        break;
      case 1:
        s2.push(a[i]);
        break;
      case 2:
        s3.push(a[i]);
        break;
      case 3:
        s4.push(a[i]);
        break;
      }
    }}, {defer: true})

  .add("Stream", function(defered) {
    var s1 = S.empty();
    var s2 = S.empty();
    var s3 = S.empty();
    var s4 = S.empty();
    s1.merge(s2).merge(s3).merge(s4)
      .subscribe(function(v) {
        if (v === n - 1) {
          defered.resolve();
        }
      });
    for (var i = 0; i < a.length; ++i) {
      switch (i % 4) {
      case 0:
        s1.push(a[i]);
        break;
      case 1:
        s2.push(a[i]);
        break;
      case 2:
        s3.push(a[i]);
        break;
      case 3:
        s4.push(a[i]);
        break;
      }
    }}, {defer: true})

  .run({async: true});
