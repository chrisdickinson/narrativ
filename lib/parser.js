// Parser
//========================
//
// This takes the output of a file,
// and attempts to group it into sections of `[[docs, code], ...]`.
// We then send all of the code sections into `pygmentize`, joined by special
// divider text comments that we later split apart to get the newly-highlighted code
// chunks.
//
// We reconcile the new chunks with the html produced from the docs (by piping it through
// `showdown`, a JavaScript implementation of Github markdown). Easy-peasy, right?
//
var method = require('./utils').method,
    path = require('path'),
    child_proc = require('child_process'),
    spawn = child_proc.spawn,
    showdown = require('./../vendor/showdown').Showdown;

// `const` ftw! We expect this html out of pygments to delimit code blocks.
// Since we're going to slice into several code blocks, it's helpful to keep
// these around to `split` and `join` by.
const highlight_start = '<div class="highlight"><pre>';
const highlight_end = '</pre></div>';

var Parser = function(destination, extensions) {
  // `extensions` is a hash of `extension: {language, symbol}`, where
  // `language` is the full name recognized by pygments and `symbol` is
  // a string representing a single line comment in the language.
  //
  // we take an instance of [Destination](file:lib/destination.js) to let
  // us rewrite file: style links in the documentation. 
  this.extensions = extensions;
  this.destination = destination;
};

Parser.prototype.match = function(pathname) {
  // `path.extname` will transform from `file.js` -> `.js`.
  return path.extname(pathname) in this.extensions;
};

Parser.prototype.parse = method(function(self, meta, source) {
  // Parse the incoming source into an array of arrays -- `[[doc, source], ...]`
  // `meta` is our `{language, symbol}` info from `extensions`.
  var symbol = meta.symbol,
      // split the source into lines, python-style
      lines = source.toString().split('\n'),
      sections = [],
      has_code = '', 
      docs_text = '',
      code_text = '';

  // This resets our `has_code`, `docs_text`, and `code_text` variable to
  // '' when invoked, as well as pushing in a new section.
  var save = function(docs, code) {
    sections.push([docs || '', code || '']);
    has_code = docs_text = code_text = '';
  };

  // match comments with any amount of preceding whitespace, and a single (optional)
  // space after the symbol. 
  var comment_match = new RegExp('\\s*'+symbol+'\\s?');

  // iterate over the lines, building up `code_text` until we
  // see a comment. at that point start accumulating `docs_text`,
  // until `has_code` is set. Once that threshold is reached, we
  // dump our doc and code into a new section and start accumulating
  // yet more docs!
  lines.forEach(function(line) {
    if(line.match(comment_match)) {
      has_code &&
        save(docs_text, code_text);

      // rewrite file: type links using [destination](file:lib/destination.js)
      docs_text += line.replace(comment_match, '').
                   replace(/\(file:(.*?)\)/g, function(all, link) {
                     return '('+self.destination.rewrite_url(link)+')';
                   })+'\n';
    } else {
      has_code = true;
      code_text += line + '\n';
    }
  });

  // one final save to make sure we've got the last of our code and docs.
  save(docs_text, code_text);
  return sections;
});

Parser.prototype.fail = function(exit) {
  // return a callback for when things go horribly wrong.
  return function(text) {
    exit(new Error('pygmentize error:\n'+text));
  };
};

Parser.prototype.accumulate = function(into) {
  // return a callback that just keeps pushing data into
  // the provided array.
  // **Weirdness Alert**: Since `into` is expected to be an array,
  // this will modify the array that `into` represents in the parent
  // scope, as well as any other scopes that array has been passed into.
  // *Let's hear it for passing by reference!*
  return function(data) {
    into.push(data);
  };
};

Parser.prototype.compile = method(function(self, file, source, callback) {
  // Load up our extension, parse our source using that metadata, and
  // spit the pertinent bits into `pygmentize`.
  var ext = path.extname(file.path),
      meta = self.extensions[ext],
      language = meta.language,
      sections = self.parse(meta, source),
      // **Weirdness**: As above, so below. This is the `into` I'm making reference
      // to in both `accumulate` and `finish_compilation`. *The magic of references!* 
      into = [];

  var pygments = spawn('pygmentize', ['-l', language, '-f', 'html', '-O', 'encoding=utf-8']);
  // fail using our provided callback
  pygments.stderr.on('data', self.fail(callback));

  // accumulate using our accumulate function that does pass-by-reference-magic.
  pygments.stdout.on('data', self.accumulate(into));

  // and when we're done, use that array in a closure returned by `finish_compilation` to 
  // get our final data.
  pygments.on('exit', self.finish_compilation(into, meta, sections, callback));

  // **NOTE**: We don't write to `pygments.stdin` until we've set up all of our listeners.
  // this is a bit of a node-ism, though it helps in case anything immediately emits the events
  // we were hoping to latch onto.

  // write our chunks to `stdin` and then close the input.
  pygments.stdin.write(sections.map(function(s) { return s[1] || ''; }).join('\n'+meta.symbol+'DIVIDER\n'));
  pygments.stdin.end();
});

Parser.prototype.finish_compilation = method(function(self, results, meta, sections, ready) {
  return function() {
    var symbol = meta.symbol,
        divider_html = new RegExp('\\n*<span class="c1?">'+symbol+'DIVIDER<\\/span>\\n*'),
        // get rid of the highlights, and split by our expected divider html.
        bits = results.
          join('').
          replace(highlight_start, '').
          replace(highlight_end, '').
          split(divider_html);

    // map our sections to a [{doc:doc_html, code:code_html}, ...] format,
    // replacing the highlights in for each code block.
    var parts = sections.slice().map(function(section, index) {
      var doc_html = section[0] && showdown.makeHtml(section[0]),
          code_html = highlight_start + bits[index] + highlight_end;
      return {doc:doc_html, code:code_html};
    });

    // let the world know how awesome our `parts` are.
    ready(null, parts);
  };
}); 

exports.Parser = Parser;
