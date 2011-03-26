exports.method = function(fn) {
  return function() {
    return fn.apply(this, [this].concat([].slice.call(arguments)));
  };
};
