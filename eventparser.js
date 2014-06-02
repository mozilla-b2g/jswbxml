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

  function EventParser() {
    this._running = false;
    this._fullPath = null;

    // The currently-running listener.
    this._currentListener = null;

    // An array of listeners at the root level.
    this._listeners = [];

    // An array of nested listener sets; each element contains a |depth| and
    // an array of |listeners|.
    this._activeListeners = [];
  }

  EventParser.prototype = {
    on: function(path, callback) {
      this._on(path, 'open', callback);
    },

    onend: function(path, callback) {
      if (typeof path === 'function') {
        this._on([], 'close', path);
      } else {
        this._on(path, 'close', callback);
      }
    },

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
          this._clearListeners();
        }
      }

      this._running = false;
    },

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
        this._activeListeners.push(this._currentListener);
        listener.callback(node);
        this._currentListener = null;
      }.bind(this);

      this._listeners.forEach(fireIfMatched);
      this._activeListeners.forEach(function(active) {
        active.listeners.forEach(fireIfMatched);
      });
    },

    _clearListeners: function() {
      var fullPath = this._fullPath;
      this._activeListeners = this._activeListeners.filter(function(listener) {
        return listener.depth <= fullPath.length;
      });
    },

    _matchPath: function(a, b) {
      return a.length === b.length && a.every(function(val, i) {
        if (b[i] === '*') {
          return true;
        } else if (Array.isArray(b[i])) {
          return b[i].indexOf(val) !== -1;
        } else {
          return val === b[i];
        }
      });
    },
  };

  return EventParser;
}));
