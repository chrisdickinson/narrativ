var method = require('./utils').method,
    join = require('path').join,
    EE = require('events').EventEmitter,
    fs = require('fs'),
    File = require('./file').File;

var Directory = function(path, parser, file_class) {
  this.path = path;
  this.parser = parser;
  this.file_class = file_class || File;
};

Directory.prototype.compile = method(function(self, options, destination) {
  options.visit(self);
  self.children().on('data', function(item) {
    item instanceof Directory && options.recurse ?
      item.compile(options, destination) : 
      item instanceof File ? 
      item.compile(options, destination) : null;
  }).on('error', options.error.bind(options));
});

Directory.prototype.children = method(function(self) {
  var ee = new EE();

  fs.readdir(self.path, function(err, files) {
    err ? 
      ee.emit('error', err) :
      files.forEach(function(file) {
        var path = join(self.path, file);
        fs.stat(path, function(err, stat) {
          err ? ee.emit('error', err, path) : 
          stat.isDirectory() ? ee.emit('data', new Directory(path, self.parser, self.file_class)) :
          stat.isFile() && self.parser.match(path) ? ee.emit('data', new self.file_class(path, self.parser)) :
          null;
        });
      });    
  });
  return ee; 
});

exports.Directory = Directory;
