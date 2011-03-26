Narrativ
========

I couldn't afford the last vowel.

What is it? It's like [Docco](http://github.com/jashkenas/docco). In fact, it uses pretty much the same algorithm, as well as
the same template + css to generate docs from given files. 

What makes it different from Docco?

*  It handles recursing into directories.
*  You can provide your own extensions file -- no need to fork the project to add support for your favorite language.
*  You can choose the template, css file, and the base media url with which to generate docs.

Installation
------------

Make sure you have node 0.3 (at minimum) installed and pygments installed.

    pip install pygments
    npm install narrativ

And you're ready to go.

Usage
-----

    Usage: narrativ [options] [list of directories or files to generate documentation from]
        -O, --target-dir                        Set the output directory
        -u, --url                               Base URL for serving stylesheets and javascript.
        --css                                   Use a custom stylesheet
        -T, --template                          Django-style template file to use when generating docs.
        -X, --extensions                        Extension JSON file, providing support for other languages.
        -I, --ignore-dirs                       Portion of target directory path to ignore when generating docs.

To generate docs for narrativ:

    git clone git://github.com/chrisdickinson/narrativ.git
    cd narrativ
    narrativ lib -O docs

If want other extensions enabled, the file looks like this: 

    {
        ".coffee":{
            "language":"coffee-script",
            "symbol":"#"
        },
        ".js":{
            "language":"javascript",
            "symbol":"//"
        },
        ".rb":{
            "language":"ruby",
            "symbol":"#"
        },
        ".py":{
            "language":"python",
            "symbol":"#"
        },
        ".c":{
            "language":"c",
            "symbol":"//"
        }
    }

Where `language` is the pygment's designation for the language you're trying to match, and `symbol` is the string representing a single 
line comment. Pass in the file to narrativ using `narrativ -X /path/to/extensions.json`.

If you want another template to render your docs with, create a django-style template. You have access to *almost* all of the tags, with the exception of `include`, `extends`, and `url`. These may be supported in a later version of narrativ. Pass in the template to narrativ
using `narrativ -T /path/to/template.html`.

Passing in CSS works similarly. It will be written to the root of your target directory. You can optionally decorate it with a URL, in case you're serving your CSS externally. To do this, pass in `narrativ -u http://localhost:8000/`, but **you must include the trailing slash.**


