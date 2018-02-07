const H = require("@funkia/hareactive");
const Maybe = require("Data.Maybe");

function uncurry2(f) {
  return function (a, b) {
    return f(a)(b);
  };
}

function curry2(f) {
  return function (a) {
    return function (b) {
      return f(a, b);
    };
  };
}

function curry3(f) {
  return function (a) {
    return function (b) {
      return function (c) {
        return f(a, b, c);
      };
    };
  };
}

exports._mapStream = curry2(function (f, s) {
  return s.map(f);
});

exports._mapBehavior = curry2(function (f, b) {
  return s.map(b);
});

exports.filter = curry2(H.filter);

exports.keepWhen = curry2(H.keepWhen);

exports.on