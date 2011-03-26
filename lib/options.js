var File = require('./file').File,
    Directory = require('./directory').Directory,
    Parser = require('./parser').Parser,
    Destination = require('./destination').Destination,
    plate = require('plate'),
    _path = require('path'),
    join = _path.join,
    basename = _path.basename,
    fs = require('fs');

var rpad = function(what, len) {
  var add = len - what.length;
  while(add > 0) {
    what += ' ';
    --add;
  } 
  return what;
};

var option = function() {
  var args = [].slice.call(arguments),
      callback = args[args.length-1],
      flags = args.slice(0, args.length-1);

  var retval = !flags.length ?
    function(opts, head, tail) {
      callback(opts, head, tail);
      return 1;
    } :
    function(opts, head, tail) {
      if(flags.indexOf(head) !== -1) {
        callback.apply({}, [opts].concat(tail.splice(0, callback.length-1)));
        return 1;
      }
      return 0;
    };

  retval.help = function(h) {
    retval.help_text = '\t'+rpad(flags.join(', '), 40) + h;
    return retval;
  };
  return retval;
};

var flag_options = [
  option('-O', '--target-dir', function(opts, target_dir) {
    opts.target_dir = target_dir;
  }).help('Set the output directory'),

  option('-u', function(opts, url) {
    opts.base_url = url;
  }).help('Base URL for serving stylesheets and javascript.'),

  option('--css', function(opts, stylesheet) {
    opts.css_file = fs.readFileSync(stylesheet);
    opts.stylesheet = basename(stylesheet);
  }).help('Use a custom stylesheet'),

  option('-T', '--template', function(opts, template) {
    opts.file_template = new plate.Template(fs.readFileSync(template).toString());
  }).help('Django-style template file to use when generating docs.'),

  option('-X', '--extensions', function(opts, extensions) {
    opts.extensions = JSON.parse(fs.readFileSync(extensions));
  }).help('Extension JSON file, providing support for other languages.'),

  option('-I', '--ignore-dirs', function(opts, dir) {
    opts.ignore_dirs = dir;
  }).help('Portion of target directory path to ignore when generating docs.'),

  option(function(opts, target) {
    opts.roots = opts.roots || [];
    fs.statSync(target).isFile() ?
      opts.roots.push(function(parser) {
        return new File(target, parser);
      }) :
      opts.roots.push(function(parser) {
        return new Directory(target, parser);
      });
  }).help('Targets')
];

var Options = function(args) {
  if(!args.length) {
    flag_options.forEach(function(flag) {
      console.log(flag.help_text);
    });
    this.error();
  }

  while(args.length) {
    var len = args.length;
    flag_options.forEach(function(flag) {
      var head = args.shift(),
          tail = args;

      var ret = flag(this, head, tail); 
      if(!ret)
        args.unshift(head);
    }, this);
    if(args.length === len)
      this.error("Can't resolve argument "+args[0]);
  }

  !this.css_file &&
    (this.css_file = fs.readFileSync(join(__dirname, '../resources/base.css')),
    (this.stylesheet = 'base.css'));

  !this.file_template &&
    (this.file_template = new plate.Template(fs.readFileSync(join(__dirname, '../resources/templates/default.html')).toString()));

  !this.extensions &&
    (this.extensions = JSON.parse(fs.readFileSync(join(__dirname, '../resources/extensions/base.json')).toString()));

  this.ignore_dirs === undefined &&
    (this.ignore_dirs = '');

  !this.target_dir &&
    (this.target_dir = join(process.cwd(), 'docs'));

  this.base_url === undefined &&
    (this.base_url = '');

  if(this.target_dir[0] !== '/') {
    this.target_dir = join(process.cwd(), this.target_dir);
  }

  this.destination = new Destination(this.target_dir.replace(this.ignore_dirs, ''), this.target_dir, this.ignore_dirs);
  this.parser = new Parser(this.destination, this.extensions);
  this.recurse = true;

  var self = this;
  self.files = [];
  File.prototype.register = function() {
    self.files.push(this);  
  };

  this.roots &&
  this.roots.forEach(function(fn) {

    fn(this.parser).compile(this, this.destination); 
  }, this);

  this.destination.write_media(this);
};

Options.prototype.visit = function(what) {
  console.log('compiling '+what.path+'...');
};

Options.prototype.error = function() {
  console.error.apply(console, arguments);
  process.exit(1);
};

Options.parse = function() {
  var args = process.ARGV.slice();
  if(args[0] === 'node') {
    args.shift();
  }
  if(args[0].indexOf('narrativ') !== -1) {
    args.shift();   
  }

  args = args.filter(function(arg) {
    return arg !== '='; 
  }).map(function(arg) {
    if(arg[arg.length-1] === '=') {
      return arg.slice(0,-1);
    }
    return arg;
  });

  return new Options(args);
};


exports.Options = Options;
