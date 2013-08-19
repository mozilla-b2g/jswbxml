/* Copyright 2012 Mozilla Foundation
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
    helpers = require('./helpers');

var verify_document = helpers.verify_document;
var verify_subdocument  = helpers.verify_subdocument;

describe('event', function() {

it('basic', function test_event_basic() {
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

  var expectedSubdoc1 = { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' };

  var e1 = new WBXML.EventParser();
  e1.addEventListener([cp.ROOT, cp.CARD], function(subdoc) {
    verify_subdocument(subdoc, expectedSubdoc1);
  });
  e1.run(new WBXML.Reader(w1, codepages));

  var w2 = new WBXML.Writer('1.1', 1, 'UTF-8');
  w2.stag(cp.ROOT)
      .stag(cp.CARD)
        .tag(cp.FIELD, a(cpa.TYPE, 'NAME'), 'Anne')
        .text('anne@anne.com')
      .etag()
    .etag();

  var expectedSubdoc2 =
    { type: 'TAG', tag: cp.CARD, localTagName: 'CARD', children: [
      { type: 'TAG', tag: cp.FIELD, localTagName: 'FIELD',
        attributes: { TYPE: 'NAME' }, children: [
          { type: 'TEXT', textContent: 'Anne' },
        ] },
      { type: 'TEXT', textContent: 'anne@anne.com' },
    ]};

  var e2 = new WBXML.EventParser();
  e2.addEventListener([cp.ROOT, cp.CARD], function(subdoc) {
    verify_subdocument(subdoc, expectedSubdoc2);
  });
  e2.run(new WBXML.Reader(w2, codepages));
});

it('overlapped', function test_event_overlapped() {
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

  var e = new WBXML.EventParser();

  e.addEventListener([cp.ROOT, cp.CARD], function(subdoc) {
    var expectedSubdoc =
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD', children: [
        { type: 'TAG', tag: cp.FIELD, localTagName: 'FIELD',
          attributes: { TYPE: 'NAME' }, children: [
            { type: 'TEXT', textContent: 'Anne' },
          ] },
        { type: 'TEXT', textContent: 'anne@anne.com' },
      ]};
    verify_subdocument(subdoc, expectedSubdoc);
  });

  e.addEventListener([cp.ROOT, cp.CARD, cp.FIELD], function(subdoc) {
    var expectedSubdoc =
      { type: 'TAG', tag: cp.FIELD, localTagName: 'FIELD',
        attributes: { TYPE: 'NAME' }, children: [
          { type: 'TEXT', textContent: 'Anne' },
        ] };
    verify_subdocument(subdoc, expectedSubdoc);
  });

  e.run(new WBXML.Reader(w, codepages));
});

}); // describe
