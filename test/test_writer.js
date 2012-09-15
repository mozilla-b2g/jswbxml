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

function test_writer_basic() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  let cp = codepages.Default.Tags;
  w.stag(cp.ROOT)
     .tag(cp.CARD)
     .tag(cp.CARD, '0')
   .etag();

  let expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: '0' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_attrs() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT, a(cpa.TYPE, 'list'))
     .tag(cp.CARD, a(cpa.TYPE, a(cpa.VCARD)),
                   a(cpa.EMAIL, ['foo@bar', a(cpa.DOT_COM)]))
     .tag(cp.CARD, a(cpa.TYPE, a(cpa.VCARD)),
                   a(cpa.EMAIL, ['bob@bob', a(cpa.DOT_COM)]), 'Bob')
   .etag();

  let expectedNodes = [
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

  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_string_table() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;
  let str_t = WBXML.Writer.str_t;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII',
                           ['list', '@example.com', 'foo', ', ']);
  w.stag(cp.ROOT, a(cpa.TYPE, str_t(0)))
     .tag(cp.CARD, a(cpa.EMAIL, [str_t(18), str_t(5)]), str_t(18))
     .tag(cp.CARD, a(cpa.EMAIL, ['ted', str_t(5)]),
          ['Danson', str_t(22), 'Ted'])
   .etag();

  let expectedNodes = [
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

  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_entity() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;
  let ent = WBXML.Writer.ent;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
    .tag(cp.CARD, ['Ted', ent(160), 'Danson'])
   .etag();

  let expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: 'Ted&#160;Danson' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_pi() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.pi(cpa.PI)
   .stag(cp.ROOT)
     .stag(cp.CARD)
     .pi(cpa.PI2)
     .etag()
   .etag()
   .pi(cpa.PI, 'END');

  let expectedNodes = [
    { type: 'PI', target: 'PI', data: ''},
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'PI', target: 'PI', data: 'PREFIX' },
      { type: 'ETAG' },
    { type: 'ETAG' },
    { type: 'PI', target: 'PI', data: 'END' },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_extension_tag() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .ext('string', 0, 'string')
     .ext('integer', 1, 42)
     .ext('byte', 2)
   .etag();

  let expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'EXT', subtype: 'string', index: 0, value: 'string' },
      { type: 'EXT', subtype: 'integer', index: 1, value: 42 },
      { type: 'EXT', subtype: 'byte', index: 2, value: null },
    { type: 'ETAG' },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_extension_attr() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;
  let ext = WBXML.Writer.ext;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .tag(cp.CARD, a(cpa.TYPE, ext('string', 0, 'string')))
     .tag(cp.CARD, a(cpa.TYPE, ['vCard', ext('integer', 1, 42)]))
     .tag(cp.CARD, a(cpa.TYPE_LIST, ext('byte', 2)))
   .etag();

  let expectedNodes = [
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
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_opaque() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .opaque('string')
     .opaque(binify('string'))
   .etag();

  let expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'OPAQUE', data: binify('string') },
      { type: 'OPAQUE', data: binify('string') },
    { type: 'ETAG' },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
}

function test_writer_utf8() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;
  let str_t = WBXML.Writer.str_t;

  let w = new WBXML.Writer('1.1', 1, 'UTF-8',
                           ['(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35',
                            '\u253b\u2501\u253b']);
  w.stag(cp.ROOT)
     .tag(cp.CARD, a(cpa.TYPE, str_t(0)), a(cpa.CLASS, str_t(19)), '\u2603')
     .stag(cp.CARD, a(cpa.TYPE, '\u2624'), a(cpa.CLASS, '\u2622'))
       .text([str_t(0), ' ', str_t(19)])
     .etag()
   .etag();

  let expectedNodes = [
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

  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
}

function test_writer_unexpected_etag() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;

  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .tag(cp.CARD)
   .etag();
  assert_throws(function() {
     w.etag();
  }, Error);
}

function test_writer_check_etag() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;

  // Test that checking the tag in etag works.
  let w = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .stag(cp.CARD)
     .etag(cp.CARD)
   .etag(cp.ROOT);

  let expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);

  // Test that checking the tag in etag fails when you specify the wrong tag.
  let w2 = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w.stag(cp.ROOT)
     .stag(cp.CARD);
  assert_throws(function() {
    w.etag(cp.ROOT);
  }, Error);
}
