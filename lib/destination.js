//  Destination
//==================================================
//  The `Destination` class defines a general target
//  for newly compiled documentation.
//
//  The idea is that a destination is created with knowledge
//  of the base directory (the lowest common denominator directory
//  of the incoming compilation request: e.g, `narrativ some/dir/file.js` would
//  produce a base directory of `some/dir`).
//
//  It is also provided the `target_dir` -- the directory to
//  emit compiled docs into. It will use `exec mkdir -p` to ensure
//  that this directory exists.
//
//  Finally, it accepts `ignore_dirs` -- directories to omit from the final
//  path. If a file has a path of `some/dir/application/file.js`, with a
//  `base_dir` of `some/dir`, and an `ignore_dirs` of `application`, the resulting
//  file will output into `{target_dir}/file.js.html` instead of `{target_dir}/application/file.js.html`.
//  This may be removed in later versions.

var fs = require('fs'),
    method = require('./utils').method,
    path = require('path'),
    dirname = path.dirname,
    join = path.join,
    child_proc = require('child_process'),
    exec = child_proc.exec,
    EE = require('events').EventEmitter;

var Destination = function(base_dir, target_dir, ignore_dirs) {
  this.base_dir = base_dir;
  this.target_dir = target_dir;
  this.ignore_dirs = ignore_dirs;
};

Destination.prototype.target_name = method(function(self, path) {
  //  Remove the `base_dir` and any `ignore_dirs` from path,
  //  and concatenate that using `path.join` to our `target_dir`.
  //  Append `.html` to the file.
  return join(
    self.target_dir,
    path.replace(self.base_dir, '').replace(self.ignore_dirs, '')
  )+'.html';
});

Destination.prototype.rewrite_url = method(function(self, path) {
  //  Used by the [parser](file:lib/parser.js) to link files together.
  return self.target_name(path).replace(self.target_dir, '');
});

Destination.prototype.ensure_path = method(function(self, path) {
  //  Ensure that the full target path exists using `mkdir -p`.
  //  Returns an `EventEmitter` that emits either `ready` or `error`
  //  depending on if the action was successful.
  var ee = new EE();

  exec('mkdir -p '+path, function(e) {
    if(e) ee.emit('error', e);
    else ee.emit('ready');
  });
  return ee;
});

Destination.prototype.render = method(function(self, file, options, sections) {
  //  Use the [template file](file:lib/options.js) to render our file.
  var target = self.target_name(file.path);
  options.file_template.render({
    'destination':self,
    'file':file,
    'options':options,
    'sections':sections,
    'files':options.files 
  }, function(err, html) {
    if(err) {
      // If there's an error, pass it to the `options` error output.
      options.error(err) 
    } else {
      // Create the path.
      self.ensure_path(dirname(target)).on('ready', function() {
        // Write the file, passing whatever error may happen
        // to `options.error`. If nothing went wrong, we're done.
        fs.writeFile(target, html, function(err) {
          err && options.error(err);
        });
      }).
      // If there's an error, call `options.error` with what happened.
      on('error', options.error.bind(options));
    }
  });
});

Destination.prototype.write_media = method(function(self, options) {
  // Make sure we write the stylesheet to the appropriate location.
  self.ensure_path(self.base_dir).on('ready', function() {
    fs.writeFile(join(self.base_dir, options.stylesheet), options.css_file, function(err) {
      // Either error out or log that we wrote the file.
      err ?
        options.error(err) :
        options.log('wrote '+options.stylesheet);
    });
  }).on('error', options.error.bind(options));
});

exports.Destination = Destination;
