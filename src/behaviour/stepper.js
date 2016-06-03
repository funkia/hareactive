var h = require('../frp-common.js');
var B = h.Behavior;
var E = h.Event;

module.exports = function(init, e) {
  var b = B.BehaviorK(init);
  e.eventListeners.push(b);
  return b;
};
