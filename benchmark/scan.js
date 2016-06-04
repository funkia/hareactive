var Benchmark = require("benchmark");
var most = require("most");
var $ = require("../src/Events.js");

var n = 10000;

var suite = new Benchmark.Suite("Scan " + n + " integers");

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
suite
   .add('Events.scan', function(defered) {
     var j = new $.Events();
     var s = $.scan(sum, 0, j);
     $.subscribe(function(e){
       if(e === result) defered.resolve();
     }, s);
     for (var i = 0; i < testData.length; i++){
       $.publish(testData[i], j);
     }
   }, {defer: true})

  .add('Most.scan', function(defered) {
    var a = most.create(function(add){
      for (var i = 0; i < testData.length; i++){
        add(testData[i]);
      }
    }).scan(sum, 0)
    .observe(function(e){
      if(e === result) defered.resolve();
    });
  }, {defer: true})

  // .add("rx", function(){

  // })
  .on("cycle", function (e){
    var t = e.target;

	  if(t.failure) {
		  console.error(t.name + 'FAILED: ' + e.target.failure);
	  } else {
		  var result = t.name + '\n '
			      + t.hz.toFixed(2) + ' op/s'
			      + ' \xb1' + t.stats.rme.toFixed(2) + '%'
			      + ' (' + t.stats.sample.length + ' samples)';

		  console.log(result);
	  }
  })
  .run({ 'async': true });
