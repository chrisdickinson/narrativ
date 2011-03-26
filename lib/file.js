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

// This will get overridden by the [Options object](file:options.js)
// when it's being used.
File.prototype.register = function() {
};

File.prototype.data = method(function(self) {
  var ee = new EE();
  fs.readFile(self.path, function(err, data) {
    err ? 
      ee.emit('error', err) :
      ee.emit('data', data.toString());
  });
  return ee; 
});

File.prototype.compile = method(function(self, options, destination) {
  self.data().
    on('error', options.error.bind(options)).
    on('data', function(data) {
      self.parser.compile(self, data, function(err, tuple_list) {
        err ? options.error(err) : 
          (options.visit(self), destination.render(self, options, tuple_list));
      });
    });
});

exports.File = File;
