// Directory
//=============
//
//  Represents compilation targets that happen to be
//  directories.
//
//  Handles recursion into said directories, as well as the
//  creation of [child `File` objects](file:lib/file.js).
//

var method = require('./utils').method,
    join = require('path').join,
    EE = require('events').EventEmitter,
    fs = require('fs'),
    File = require('./file').File;

var Directory = function(path, parser, file_class) {
  //Arguments are:
  //
  //*  `path`: An absolute path to this directory
  //*  `parser`: An instance of the [Parser class](file:lib/parser.js).
  //*  `file_class`: Defaults to [File](file:lib/file.js), but can be overriden (for test stubbing)
  
  this.path = path;
  this.parser = parser;
  this.file_class = file_class || File;
};

Directory.prototype.compile = method(function(self, options, destination) {
  // Let options know we've been touched
  options.visit(self);

  // When we receive a child, check to see whether it is a `Directory`
  // or a `File`, and make sure that `options.recurse` is enabled (by default, it is).
  // Then if it all checks out, compile the child! 
  self.children().on('data', function(item) {
    item instanceof Directory && options.recurse ?
      item.compile(options, destination) : 
      item instanceof File ? 
      item.compile(options, destination) : null;

  // Of course, we should always let options know if there was an error grabbing our children.
  }).on('error', options.error.bind(options));
});

Directory.prototype.children = method(function(self) {
  // Returns an `EventEmitter` that emits `data` once per directory child,
  // or `error` if there is an error reading the directory.
  var ee = new EE();

  fs.readdir(self.path, function(err, files) {
    err ? 
      ee.emit('error', err) :
      files.forEach(function(file) {

        // get the full path to the child and run `fs.stat` on it to determine
        // whether we're dealing with a file or a subdirectory.
        //
        // also, if it's a file, double check that the [parser](file:lib/parser.js) supports it.
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
