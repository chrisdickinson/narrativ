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

  option('-u', '--url', function(opts, url) {
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

  option('-h', '--help', '-?', '?', function(opts) {
    opts.usage();
    opts.error();
  }),

  option('-I', '--ignore-dirs', function(opts, dir) {
    opts.ignore_dirs = dir;
  }).help('Portion of target directory path to ignore when generating docs.'),

  option(function(opts, target) {
    var retval;
    opts.roots = opts.roots || [];
    if(fs.statSync(target).isFile()) {
      retval = function(parser) {
        return new File(target, parser);
      };
      retval.target = dirname(target);
    } else {
      retval = function(parser) {
        return new Directory(target, parser);
      };
      retval.target = target;
    }
    opts.roots.push(retval);
  }).help('Targets')
];

var Options = function(args) {
  if(!args.length) {
    this.usage();
    this.error();
  }

  while(args.length) {
    for(var i = 0, len = flag_options.length; i < len && args.length; ++i) {
      var head = args.shift(),
          tail = args;

      var ret = flag_options[i](this, head, tail); 
      if(!ret) {
        args.unshift(head);
      } else {
        break;
      }
    }
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

  this.destination = new Destination(this.target_dir, this.target_dir, this.ignore_dirs);
  this.recurse = true;

  var self = this;
  self.files = [];
  File.prototype.register = function() {
    self.files.push(this);  
  };

  this.roots &&
  this.roots.forEach(function(fn) {
    var destination = new Destination(fn.target, this.target_dir, this.ignore_dirs);
    var parser = new Parser(destination, this.extensions);
    fn(parser).compile(this, destination); 
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

Options.prototype.usage = function() {
  console.log("Usage: narrativ [options] [list of directories or files to generate documentation from]");
  flag_options.forEach(function(flag) {
    console.log(flag.help_text);
  });
};

exports.Options = Options;
