var method = require('./utils').method,
    path = require('path'),
    child_proc = require('child_process'),
    spawn = child_proc.spawn,
    showdown = require('./../vendor/showdown').Showdown;

const highlight_start = '<div class="highlight"><pre>';
const highlight_end = '</pre></div>';

var Parser = function(destination, extensions) {
  this.extensions = extensions;
  this.destination = destination;
};

Parser.prototype.match = function(pathname) {
  return path.extname(pathname) in this.extensions;
};

Parser.prototype.parse = method(function(self, meta, source) {
  var symbol = meta.symbol,
      lines = source.toString().split('\n'),
      sections = [],
      has_code = '', 
      docs_text = '',
      code_text = '';

  var save = function(docs, code) {
    sections.push([docs || '', code || '']);
    has_code = docs_text = code_text = '';
  };

  var comment_match = new RegExp('\\s*'+symbol+'\\s?'),
      divider = '\n'+symbol+'DIVIDER\n';

  lines.forEach(function(line) {
    if(line.match(comment_match)) {
      has_code &&
        save(docs_text, code_text);
      docs_text += line.replace(comment_match, '').
                   replace(/\(file:(.*?)\)/g, function(all, link) {
                     return '['+self.destination.rewrite_url(link)+']';
                   })+'\n';
    } else {
      has_code = true;
      code_text += line + '\n';
    }
  });

  save(docs_text, code_text);
  return sections;
});

Parser.prototype.fail = function(exit) {
  return function(text) {
    exit(new Error('pygmentize error:\n'+text));
  };
};

Parser.prototype.accumulate = function(into) {
  return function(data) {
    into.push(data);
  };
};

Parser.prototype.compile = method(function(self, file, source, callback) {
  var ext = path.extname(file.path),
      meta = self.extensions[ext],
      language = meta.language,
      sections = self.parse(meta, source),
      into = [];

  var pygments = spawn('pygmentize', ['-l', language, '-f', 'html', '-O', 'encoding=utf-8']);
  pygments.stderr.on('data', self.fail(callback));
  pygments.stdout.on('data', self.accumulate(into));
  pygments.on('exit', self.finish_compilation(into, meta, sections, callback));

  pygments.stdin.write(sections.map(function(s) { return s[1] || ''; }).join('\n'+meta.symbol+'DIVIDER\n'));
  pygments.stdin.end();
});

Parser.prototype.finish_compilation = method(function(self, results, meta, sections, ready) {
  return function() {
    var symbol = meta.symbol,
        divider_html = new RegExp('\\n*<span class="c1?">'+symbol+'DIVIDER<\\/span>\\n*'),
        bits = results.
          join('').
          replace(highlight_start, '').
          replace(highlight_end, '').
          split(divider_html);

    var parts = sections.slice().map(function(section, index) {
      var doc_html = section[0] && showdown.makeHtml(section[0]),
          code_html = highlight_start + bits[index] + highlight_end;
      return {doc:doc_html, code:code_html};
    });

    ready(null, parts);
  };
}); 

exports.Parser = Parser;
