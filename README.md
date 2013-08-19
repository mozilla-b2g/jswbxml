jswbxml
=======

A Javascript library to read/write WBXML

The library can be used:
- in node.js
- in the browser as an AMD module
- in the browser, creating the WBXML global

Testing
-------

Running the tests requires node.js v0.8+.  You need to run "npm install"
to install the testing dependencies, then invoke mocha, possibly via running
"npm test"

Alternately, if you run "make test" it will perform these two steps for you.

Acknowledgements
----------------

Thanks to Joshua Bell of the Chromium team for the string encoding shim:
http://code.google.com/p/stringencoding/
