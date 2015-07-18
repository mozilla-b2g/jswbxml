/* Copyright 2012-2014 Mozilla Foundation
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

'use strict';

var mocha = require('mocha'),
    assert = require('chai').assert,
    WBXML = require('../wbxml'),
    PathReader = require('../pathreader'),
    helpers = require('./helpers');

var verify_node = helpers.verify_node;

describe('event', function() {

it('basic', function test_pathreader_basic() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
        FIELD: 0x07,
      },
      Attrs: {
        TYPE: { value: 0x05 },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;

  var w1 = new WBXML.Writer('1.1', 1, 'UTF-8');
  w1.stag(cp.ROOT)
      .tag(cp.CARD)
    .etag();

  var r1 = new PathReader();
  r1.on([cp.ROOT, cp.CARD], function(node) {
    verify_node(node, { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' });
  });
  r1.onend([cp.ROOT, cp.CARD], function(node) {
    verify_node(node, { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' });
  });
  r1.run(new WBXML.Reader(w1, codepages));

  var w2 = new WBXML.Writer('1.1', 1, 'UTF-8');
  w2.stag(cp.ROOT)
      .stag(cp.CARD)
        .tag(cp.FIELD, a(cpa.TYPE, 'NAME'), 'Anne')
        .text('anne@anne.com')
      .etag()
    .etag();

  var r2 = new PathReader();
  r2.on([cp.ROOT, cp.CARD], function(node) {
    verify_node(node, { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' });

    r2.on([cp.FIELD], function(node) {
      verify_node(node, { type: 'STAG', tag: cp.FIELD, localTagName: 'FIELD',
                          attributes: { TYPE: 'NAME' } });

      r2.on(['text'], function(node) {
        verify_node(node, { type: 'TEXT', textContent: 'Anne' });
      });
    });

    r2.on(['text'], function(node) {
      verify_node(node, { type: 'TEXT', textContent: 'anne@anne.com' });
    });

    r2.onend(function(node) {
      verify_node(node, { type: 'ETAG', tag: cp.CARD, localTagName: 'CARD' });
    });
  });
  r2.run(new WBXML.Reader(w2, codepages));
});

it('overlapped', function test_pathreader_overlapped() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
        FIELD: 0x07,
      },
      Attrs: {
        TYPE: { value: 0x05 },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .stag(cp.CARD)
       .tag(cp.FIELD, a(cpa.TYPE, 'NAME'), 'Anne')
       .text('anne@anne.com')
     .etag()
   .etag();

  var r = new PathReader();

  r.on([cp.ROOT, cp.CARD], function(node) {
    verify_node(node, { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' });

    r.on([cp.FIELD], function(node) {
      verify_node(node, { type: 'STAG', tag: cp.FIELD, localTagName: 'FIELD',
                          attributes: { TYPE: 'NAME' } });

      r.on(['text'], function(node) {
        verify_node(node, { type: 'TEXT', textContent: 'Anne' });
      });
    });

    r.on(['text'], function(node) {
      verify_node(node, { type: 'TEXT', textContent: 'anne@anne.com' });
    });

    r.onend(function(node) {
      verify_node(node, { type: 'ETAG', tag: cp.CARD, localTagName: 'CARD' });
    });
  });

  r.on([cp.ROOT, cp.CARD, cp.FIELD], function(node) {
    verify_node(node, { type: 'STAG', tag: cp.FIELD, localTagName: 'FIELD',
                        attributes: { TYPE: 'NAME' } });

    r.on(['text'], function(node) {
      verify_node(node, { type: 'TEXT', textContent: 'Anne' });
    });
  });

  r.run(new WBXML.Reader(w, codepages));
});

}); // describe
