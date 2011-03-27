// File API
// ========
//
// Provides access to targeted source files.

var method = require('./utils').method,
    EE = require('events').EventEmitter,
    fs = require('fs');

var File = function(path, parser) {
  this.path = path;
  this.parser = parser;
  this.filename = require('path').basename(this.path);

  this.register();
};

File.prototype.register = function() {
// This will get overridden by the [Options object](file:lib/options.js)
// when it's being used.
};

File.prototype.data = method(function(self) {
  // Returns an `EventEmitter` that emits `error` if `self.path` does not exist,
  // or `data` with the string contents of the file if the file was found.
  var ee = new EE();
  fs.readFile(self.path, function(err, data) {
    err ? 
      ee.emit('error', err) :
      ee.emit('data', data.toString());
  });
  return ee; 
});

File.prototype.compile = method(function(self, options, destination) {
  // Grab our data...
  self.data().
    // if we fail, let [options](file:lib/options.js) know.
    on('error', options.error.bind(options)).
    on('data', function(data) {

      // Cool, we've got data, let's compile it.
      self.parser.compile(self, data, function(err, tuple_list) {
        // If it worked, notify options using `visit` and [render the parsed file](file:lib/destination.js).
        err ? options.error(err) : 
          (options.visit(self), destination.render(self, options, tuple_list));
      });
    });
});

exports.File = File;
