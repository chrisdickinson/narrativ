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
  return join(
    self.target_dir,
    path.replace(self.base_dir, '').replace(self.ignore_dirs, '')
  )+'.html';
});

Destination.prototype.rewrite_url = method(function(self, path) {
  return self.target_name(path).replace(self.target_dir, '');
});

Destination.prototype.ensure_path = method(function(self, path) {
  var ee = new EE();

  exec('mkdir -p '+path, function(e) {
    if(e) ee.emit('error', e);
    else ee.emit('ready');
  });
  return ee;
});

Destination.prototype.render = method(function(self, file, options, sections) {
  var target = self.target_name(file.path);
  options.file_template.render({
    'destination':self,
    'file':file,
    'options':options,
    'sections':sections,
    'files':options.files 
  }, function(err, html) {
    self.ensure_path(dirname(target)).on('ready', function() {
      fs.writeFile(target, html, function(err) {
        err && options.error(err);
      });
    }).on('error', options.error.bind(options));
  });
});

Destination.prototype.write_media = method(function(self, options) {
  self.ensure_path(self.base_dir).on('ready', function() {
    fs.writeFile(join(self.base_dir, options.stylesheet), options.css_file, function(err) {
      err ?
        options.error(err) :
        console.log('wrote '+options.stylesheet);
    });
  }).on('error', options.error.bind(options));
});

exports.Destination = Destination;
