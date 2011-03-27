// This handy-dandy function makes life **so** much easier when
// your member functions are going to be including more than one or
// two callbacks.
//
// `method`: Automatically prepends the initial value of `this` to the
// argument list of the incoming function, so you get python-style `self`
// references that *actually close in a sane way*.
exports.method = function(fn) {
  return function() {
    return fn.apply(this, [this].concat([].slice.call(arguments)));
  };
};
