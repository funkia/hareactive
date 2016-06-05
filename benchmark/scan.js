var Suite = require("./default-suite");
var most = require("most");
var $ = require("../src/Events.js");
var $_old = require("../src/Events_old.js");

var n = 100000;

var testData = [];
var result = 0;
for (var i = 0; i < n; i++) {
  testData[i]=i;
  result += i;
};

var sum = function(curr, val){
  return curr+val;
};

// add tests
Suite("Scan")

  .add('Events', function(defered) {
    var j = new $.Events();
    var s = $.scan(sum, 0, j);
    $.subscribe(function(e){
      if(e === result) defered.resolve();
    }, s);
    for (var i = 0; i < testData.length; i++){
      $.publish(testData[i], j);
    }
  }, {defer: true})

  .add('Events_old', function(defered) {
    var j = new $_old.Events();
    var s = $_old.scan(sum, 0, j);
    $.subscribe(function(e){
      if(e === result) defered.resolve();
    }, s);
    for (var i = 0; i < testData.length; i++){
      $_old.publish(testData[i], j);
    }
  }, {defer: true})

  .add('most', function(defered) {
    var a = most.create(function(add){
      for (var i = 0; i < testData.length; i++){
        add(testData[i]);
      }
    }).scan(sum, 0)
    .observe(function(e){
      if(e === result) defered.resolve();
    });
  }, {defer: true})

  .run({ 'async': true });
