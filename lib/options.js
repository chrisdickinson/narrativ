//Options
//=================
//  Options provides the CLI interface for Narrativ.

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
  // Make sure that the string is at least `len` characters long,
  // padding the input on the right with spaces until it reaches
  // that length.
  var add = len - what.length;
  while(add > 0) {
    what += ' ';
    --add;
  } 
  return what;
};

var option = function() {
  // Defines a flag or positional argument,
  // a callback for applying the result to the options object,
  // and help text.
  var args = [].slice.call(arguments),
      callback = args[args.length-1],
      // Grab `0-(N-1)` arguments from the invocation.
      // The last argument will be our `callback`.
      flags = args.slice(0, args.length-1);

  // Store the returned function here
  // so we can modify attributes of it later, dynamically.
  var retval = !flags.length ?
    // If there aren't any flags defined
    // return a positional callback, taking `Options`, the first argument left,
    // and an array of the remaining arguments.
    function(opts, head, tail) {
      callback(opts, head, tail);
      // Returning one means that we've successfully popped an argument off the list.
      return 1;
    } :
    function(opts, head, tail) {
      // If `head` is one of our flags,
      // return 1 to let the caller know that we've successfully matched the argument
      // and `head` need not be unshifted back onto the argument list.
      if(flags.indexOf(head) !== -1) {
        // splice from 0 to the number of non-options arguments that the 
        // `callback` accepts (determined by `Function.prototype.length`.
        callback.apply({}, [opts].concat(tail.splice(0, callback.length-1)));
        return 1;
      }
      return 0;
    };

  // the help function assigns `help_text` to the returned function,
  // letting us decorate the outgoing function with additional help information.
  retval.help = function(h) {
    retval.help_text = '\t'+rpad(flags.join(', '), 40) + h;
    return retval;
  };
  return retval;
};

// Our list of flags and positional options.
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
    // **Bias Alert**: I like using [plate](http://github.com/chrisdickinson/plate), partially because
    // I wrote it and partially because it's got nice support for asynchronous template rendering.
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
    // this will throw an Error if the target
    // does not exist on the file system.
    // the calling loop will catch it and skip this argument when this happens.
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

// Options
//--------
//
// This class provides useful shortcuts for
// outputing information, as well as stores the incoming
// flags and positional argument results from the command line.
var Options = function(args) {
  // If we've got no options, print the usage
  // and then exit.
  if(!args.length) {
    this.usage();
    this.error();
  }

  // while there are args we'll continue to search
  // for options to match them.
  while(args.length) {
    for(var i = 0, len = flag_options.length; i < len && args.length; ++i) {
      var head = args.shift(),
          tail = args;

      var ret = flag_options[i](this, head, tail); 
      if(!ret) {
        // if we didn't match, push the head back onto
        // the arg stack.
        args.unshift(head);
      } else {
        // otherwise, break and retry the options from the top.
        break;
      }
    }
  }

  // Set default value for `css_file` and `stylesheet`.
  !this.css_file &&
    (this.css_file = fs.readFileSync(join(__dirname, '../resources/base.css')),
    (this.stylesheet = 'base.css'));

  // Set the default value for the `file_template`.
  !this.file_template &&
    (this.file_template = new plate.Template(fs.readFileSync(join(__dirname, '../resources/templates/default.html')).toString()));

  // Set the default extensions (can you tell I like the `test && (do = this)` syntax?)
  !this.extensions &&
    (this.extensions = JSON.parse(fs.readFileSync(join(__dirname, '../resources/extensions/base.json')).toString()));

  this.ignore_dirs === undefined &&
    (this.ignore_dirs = '');

  // If there's no target dir, just output into docs in the current directory.
  !this.target_dir &&
    (this.target_dir = join(process.cwd(), 'docs'));

  // Set the default base url -- this is how external media (like styles) will be referenced.
  this.base_url === undefined &&
    (this.base_url = '');

  // if our target dir isn't absolute, *make* it absolute.
  if(this.target_dir[0] !== '/') {
    this.target_dir = join(process.cwd(), this.target_dir);
  }

  // a flag that doesn't have an option yet --
  // the idea being that we occasionally won't want to
  // recurse into subdirectories.
  this.recurse = true;

  // set `File.prototype.register` to add new files into a
  // list maintained by this options object. See [file.js](file:lib/file.js)
  var self = this;
  self.files = [];
  File.prototype.register = function() {
    self.files.push(this);  
  };

  // if we've got roots -- directories or files that need to be
  // compiled -- create docs for each of them.
  this.roots &&
  this.roots.forEach(function(fn) {
    var destination = new Destination(fn.target, this.target_dir, this.ignore_dirs);
    var parser = new Parser(destination, this.extensions);
    fn(parser).compile(this, destination); 
    destination.write_media(this);
  }, this);
};

Options.prototype.visit = function(what) {
  // Prints a notification whenever a file or directory is visited by `compile`.
  console.log('compiling '+what.path+'...');
};

Options.prototype.log = function() {
  // Dummy log wrapper.
  console.log.apply(console, arguments);
};

Options.prototype.error = function() {
  // Error spits out the arguments and then closes the process.
  console.error.apply(console, arguments);
  process.exit(1);
};

Options.parse = function() {
  var args = process.ARGV.slice();
  // skip `node` if it's in ARGV
  if(args[0] === 'node') {
    args.shift();
  }

  // do the same with `narrativ`.
  if(args[0].indexOf('narrativ') !== -1) {
    args.shift();   
  }

  // make sure that we don't get args like `['--this','=','that']` or `['--this=','that']`.
  // these are cleaned into `['--this', 'that']`.
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

// Print the usage, and print any information the flags have
// about their usage, and exit.
Options.prototype.usage = function() {
  console.log("Usage: narrativ [options] [list of directories or files to generate documentation from]");
  flag_options.forEach(function(flag) {
    console.log(flag.help_text);
  });
};

exports.Options = Options;
