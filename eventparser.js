/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (root, factory) {
  // node.js
  if (typeof exports === 'object') {
    module.exports = factory();
    this.Blob = require('./blob').Blob;
    var stringencoding = require('stringencoding');
    this.TextEncoder = stringencoding.TextEncoder;
    this.TextDecoder = stringencoding.TextDecoder;
  }
  // browser environment, AMD loader
  else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
  // browser environment, no AMD loader
  else {
    root.WBXMLEventParser = factory();
  }
}(this, function() {
  'use strict';

  /**
   * Create a new EventParser. EventParsers are objects that allow you to listen
   * for a certain path to be emitted from an WBXML Reader, sort of like a
   * simplified version of XPath.
   *
   * Events are registered with the |on| method (or |onend| if you want to
   * listen for a closing tag), and you can register events inside of other
   * event handlers, allowing you to handle sub-nodes easily.
   *
   * The |on| and |onend| methods take paths, which are arrays of tags, similar
   * to an XPath query. Normally, each element is the tag's numeric ID, but you
   * can pass in an array of tags for a particular to match any of them at that
   * level. You can also pass '*' to match any tag. For non-tag entities, you
   * can use the strings 'text', 'ext', 'pi', and 'opaque' to match text nodes,
   * extension nodes, processing instructions, or opaque blobs, respectively.
   */
  function EventParser() {
    this._running = false;
    this._fullPath = null;

    // The currently-running listener.
    this._currentListener = null;

    // An array of listeners at the root level.
    this._listeners = [];

    // An array of nested listener sets; each element contains a |depth| and
    // an array of |listeners|.
    this._innerListeners = [];
  }

  EventParser.prototype = {
    /**
     * Register a listener for a particular path. Fires when the reader emits
     * the opening tag in question.
     *
     * @param {Array} path The path to look for.
     * @param {Function} callback The function for handling the event; takes the
     *   found node as an argument.
     */
    on: function(path, callback) {
      this._on(path, 'open', callback);
    },

    /**
     * Register a listener for a particular path. Fires when the reader emits
     * the closing tag in question.
     *
     * @param {Array} path (optional) The path to look for.
     * @param {Function} callback The function for handling the event; takes the
     *   found node as an argument.
     */
    onend: function(path, callback) {
      if (typeof path === 'function') {
        this._on([], 'close', path);
      } else {
        this._on(path, 'close', callback);
      }
    },

    /**
     * Register a listener for a particular path.
     *
     * @param {Array} path The path to look for.
     * @param {String} mode Either 'open' or 'close', depending on whether the
     *   event should be fired on the opening or closing tag.
     * @param {Function} callback The function for handling the event; takes the
     *   found node as an argument.
     */
    _on: function(path, mode, callback) {
      var listeners;

      if (this._running) {
        path = this._fullPath.concat(path);
        listeners = this._currentListener.listeners;
      }
      else {
        listeners = this._listeners;
      }

      listeners.push({
        path: path,
        mode: mode,
        callback: callback,
      });
    },

    /**
     * Parse a WBXML document and start firing events as appropriate.
     *
     * @param {WBXML.Reader} reader The document's Reader.
     */
    run: function(reader) {
      this._fullPath = [];
      this._running = true;

      var doc = reader.document;
      var doclen = doc.length;
      for (var iNode = 0; iNode < doclen; iNode++) {
        var node = doc[iNode];
        if (node.type !== 'ETAG') {
          var pathElement;
          switch (node.type) {
          case 'STAG':
          case 'TAG':
            pathElement = node.tag;
            break;
          case 'TEXT':
            pathElement = 'text';
            break;
          case 'EXT':
            pathElement = 'ext';
            break;
          case 'PI':
            pathElement = 'pi';
            break;
          case 'OPAQUE':
            pathElement = 'opaque';
            break;
          }

          this._fullPath.push(pathElement);
          this._fireListeners(node, 'open');
        }

        if (node.type !== 'STAG') {
          this._fireListeners(node, 'close');
          this._fullPath.pop();

          // Since we just popped an element off our path, clear out any nested
          // listeners that are no longer relevant.
          this._innerListeners = this._innerListeners.filter(
            function(listener) {
              return listener.depth <= this._fullPath.length;
            }.bind(this)
          );
        }
      }

      this._running = false;
    },

    /**
     * Fire all the listeners for a particular node.
     *
     * @param {Node} node The node.
     * @param {String} mode Either 'open' or 'closed', depending on whether the
     *   tag is being opened or closed.
     */
    _fireListeners: function(node, mode) {
      var fireIfMatched = function(listener) {
        if (mode !== listener.mode ||
            !this._matchPath(this._fullPath, listener.path)) {
          return;
        }

        this._currentListener = {
          depth: this._fullPath.length,
          listeners: [],
        };
        this._innerListeners.push(this._currentListener);
        listener.callback(node);
        this._currentListener = null;
      }.bind(this);

      this._listeners.forEach(fireIfMatched);
      this._innerListeners.forEach(function(inner) {
        inner.listeners.forEach(fireIfMatched);
      });
    },

    /**
     * Determine if an XML path matches our expectation.
     *
     * @param {Array} actual The actual path.
     * @param {Array} expected The expected path.
     * @return {Boolean} True if they match, false otherwise.
     */
    _matchPath: function(actual, expected) {
      if (actual.length !== expected.length) {
        return false;
      }
      return actual.every(function(val, i) {
        if (expected[i] === '*') {
          return true;
        } else if (Array.isArray(expected[i])) {
          return expected[i].indexOf(val) !== -1;
        } else {
          return val === expected[i];
        }
      });
    }
  };

  return EventParser;
}));
