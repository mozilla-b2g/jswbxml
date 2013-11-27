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
    helpers = require('./helpers'),
    blobMod = require('../blob');

var verify_document = helpers.verify_document;
var verify_subdocument  = helpers.verify_subdocument;
var binify = helpers.binify;

var Blob = blobMod.Blob;
var FileReader = blobMod.FileReader;

describe('writer', function() {

it('basic', function test_writer_basic() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  var cp = codepages.Default.Tags;
  w.stag(cp.ROOT)
     .tag(cp.CARD)
     .tag(cp.CARD, '0')
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: '0' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('attrs', function test_writer_attrs() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        TYPE:    { value: 0x05 },
        EMAIL:   { value: 0x06 },
        VCARD:   { value: 0x85, data: 'vCard' },
        DOT_COM: { value: 0x86, data: '.com' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT, a(cpa.TYPE, 'list'))
     .tag(cp.CARD, a(cpa.TYPE, a(cpa.VCARD)),
                   a(cpa.EMAIL, ['foo@bar', a(cpa.DOT_COM)]))
     .tag(cp.CARD, a(cpa.TYPE, a(cpa.VCARD)),
                   a(cpa.EMAIL, ['bob@bob', a(cpa.DOT_COM)]), 'Bob')
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT',
      attributes: { TYPE: 'list' } },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: 'vCard', EMAIL: 'foo@bar.com' } },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: 'vCard', EMAIL: 'bob@bob.com' } },
        { type: 'TEXT', textContent: 'Bob' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('string table', function test_writer_string_table() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        TYPE:  { value: 0x05 },
        EMAIL: { value: 0x06 },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;
  var str_t = WBXML.Writer.str_t;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8',
                           ['list', '@example.com', 'foo', ', ']);
  w.stag(cp.ROOT, a(cpa.TYPE, str_t(0)))
     .tag(cp.CARD, a(cpa.EMAIL, [str_t(18), str_t(5)]), str_t(18))
     .tag(cp.CARD, a(cpa.EMAIL, ['ted', str_t(5)]),
          ['Danson', str_t(22), 'Ted'])
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT',
      attributes: { TYPE: 'list' } },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { EMAIL: 'foo@example.com' } },
        { type: 'TEXT', textContent: 'foo' },
      { type: 'ETAG' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { EMAIL: 'ted@example.com' } },
        { type: 'TEXT', textContent: 'Danson, Ted' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('entity', function test_writer_entity() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var ent = WBXML.Writer.ent;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
    .tag(cp.CARD, ['Ted', ent(160), 'Danson'])
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: 'Ted&#160;Danson' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('pi', function test_writer_pi() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        PI:  { value: 0x05 },
        PI2: { value: 0x06, name: 'PI', data: 'PREFIX' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.pi(cpa.PI)
   .stag(cp.ROOT)
     .stag(cp.CARD)
     .pi(cpa.PI2)
     .etag()
   .etag()
   .pi(cpa.PI, 'END');

  var expectedNodes = [
    { type: 'PI', target: 'PI', data: ''},
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'PI', target: 'PI', data: 'PREFIX' },
      { type: 'ETAG' },
    { type: 'ETAG' },
    { type: 'PI', target: 'PI', data: 'END' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('extension tag', function test_writer_extension_tag() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .ext('string', 0, 'string')
     .ext('integer', 1, 42)
     .ext('byte', 2)
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'EXT', subtype: 'string', index: 0, value: 'string' },
      { type: 'EXT', subtype: 'integer', index: 1, value: 42 },
      { type: 'EXT', subtype: 'byte', index: 2, value: null },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('extension attr', function test_writer_extension_attr() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        TYPE:      { value: 0x05 },
        TYPE_LIST: { value: 0x06, name: 'TYPE', data: 'LIST' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;
  var ext = WBXML.Writer.ext;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .tag(cp.CARD, a(cpa.TYPE, ext('string', 0, 'string')))
     .tag(cp.CARD, a(cpa.TYPE, ['vCard', ext('integer', 1, 42)]))
     .tag(cp.CARD, a(cpa.TYPE_LIST, ext('byte', 2)))
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: { type: 'EXT', subtype: 'string', index: 0,
                              value: 'string' } } },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: ['vCard',
                             { type: 'EXT', subtype: 'integer', index: 1,
                               value: 42 }] } },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: ['LIST',
                             { type: 'EXT', subtype: 'byte', index: 2,
                               value: null }] } },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('opaque', function test_writer_opaque() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .opaque('string')
     .opaque(binify('string'))
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'OPAQUE', data: binify('string') },
      { type: 'OPAQUE', data: binify('string') },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('utf8', function test_writer_utf8() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        TYPE:  { value: 0x05 },
        CLASS: { value: 0x06, data: '\u2623' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;
  var cpa = codepages.Default.Attrs;

  var a = WBXML.Writer.a;
  var str_t = WBXML.Writer.str_t;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8',
                           ['(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35',
                            '\u253b\u2501\u253b']);
  w.stag(cp.ROOT)
     .tag(cp.CARD, a(cpa.TYPE, str_t(0)), a(cpa.CLASS, str_t(19)), '\u2603')
     .stag(cp.CARD, a(cpa.TYPE, '\u2624'), a(cpa.CLASS, '\u2622'))
       .text([str_t(0), ' ', str_t(19)])
     .etag()
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35',
                      CLASS: '\u2623\u253b\u2501\u253b' }
      },
        { type: 'TEXT', textContent: '\u2603'},
      { type: 'ETAG' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: '\u2624', CLASS: '\u2623\u2622' } },
        { type: 'TEXT', textContent: '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35 ' +
                                     '\u253b\u2501\u253b'},
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('unexpected etag', function test_writer_unexpected_etag() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .tag(cp.CARD)
   .etag();
  assert.throws(function() {
     w.etag();
  }, Error);
});

it('check etag', function test_writer_check_etag() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  // Test that checking the tag in etag works.
  var w = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .stag(cp.CARD)
     .etag(cp.CARD)
   .etag(cp.ROOT);

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);

  // Test that checking the tag in etag fails when you specify the wrong tag.
  var w2 = new WBXML.Writer('1.1', 1, 'UTF-8');
  w.stag(cp.ROOT)
     .stag(cp.CARD);
  assert.throws(function() {
    w.etag(cp.ROOT);
  }, Error);
});

it('produces blobs', function test_writer_create_blobs(done) {
  // This is the 'basic' test modified to eat Blobs
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var w = new WBXML.Writer('1.1', 1, 'UTF-8', null, 'blob');
  var cp = codepages.Default.Tags;
  w.stag(cp.ROOT)
     .tag(cp.CARD)
     .tag(cp.CARD, '0')
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: '0' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var fileReader = new FileReader();
  fileReader.onload = function() {
    var r = new WBXML.Reader(new Uint8Array(fileReader.result), codepages);
    verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
    done();
  };
  var blob = w.blob;
  assert.equal(blob._parts.length, 1);
  assert(blob._parts[0] instanceof Uint8Array);
  fileReader.readAsArrayBuffer(blob);
});

it('creates super blobs using opaque', function test_write_opaque_blobs(done) {
  // This is the 'opaque' test modified to use Blobs
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  var w = new WBXML.Writer('1.1', 1, 'UTF-8', null, 'blob');
  w.stag(cp.ROOT)
     // Blob that's made up of a String
     .opaque(new Blob(['string']))
     // Blob that's made up of 2 strings
     .opaque(new Blob(['stra', 'ng']))
     // Blob that's holding a uint8 TypedArray
     .opaque(new Blob([binify('strung')]))
     // Just put in a string
     .opaque('strunged')
   .etag();

  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'OPAQUE', data: binify('string') },
      { type: 'OPAQUE', data: binify('strang') },
      { type: 'OPAQUE', data: binify('strung') },
      { type: 'OPAQUE', data: binify('strunged') },
    { type: 'ETAG' },
  ];
  var fileReader = new FileReader();
  fileReader.onload = function() {
    var r = new WBXML.Reader(new Uint8Array(fileReader.result), codepages);
    verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
    done();
  };
  var blob = w.blob;
  assert.equal(blob._parts.length, 7);
  assert(blob._parts[0] instanceof Uint8Array);
  assert(blob._parts[1] instanceof Blob);
  assert(blob._parts[2] instanceof Uint8Array);
  assert(blob._parts[3] instanceof Blob);
  assert(blob._parts[4] instanceof Uint8Array);
  assert(blob._parts[5] instanceof Blob);
  assert(blob._parts[6] instanceof Uint8Array);

  fileReader.readAsArrayBuffer(blob);
});

it('tracks first written tag name', function test_first_tag_name() {
  var codepages = {
    Default: {
      Tags: {
        FOO: 0x05,
        BAR: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var cp = codepages.Default.Tags;

  var wFoo = new WBXML.Writer('1.1', 1, 'UTF-8');
  wFoo.stag(cp.FOO)
        .tag(cp.BAR)
        .tag(cp.BAR, '0')
      .etag();

  var wBar = new WBXML.Writer('1.1', 1, 'UTF-8');
  wBar.stag(cp.BAR)
        .tag(cp.FOO)
        .tag(cp.FOO, '0')
      .etag();

  assert.equal(wFoo.rootTag, cp.FOO, 'first tag is FOO');
  assert.equal(wBar.rootTag, cp.BAR, 'first tag is BAR');
});

}); // describe
