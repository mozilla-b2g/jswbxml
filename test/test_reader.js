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
var binify = helpers.binify;

describe('reader', function() {

// http://www.w3.org/TR/wbxml/#_Toc443384926
it('w3c simple', function test_reader_w3c_simple() {
  var data = binify([
    0x01, 0x01, 0x03, 0x00, 0x47, 0x46, 0x03,  ' ',  'X',  ' ',  '&',  ' ',
     'Y', 0x00, 0x05, 0x03,  ' ',  'X', 0x00, 0x02, 0x81, 0x20, 0x03,  '=',
    0x00, 0x02, 0x81, 0x20, 0x03,  '1',  ' ', 0x00, 0x01, 0x01
  ]);
  var codepages = {
    Default: {
      Tags: {
        BR:   0x05,
        CARD: 0x06,
        XYZ:  0x07,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var cp = codepages.Default.Tags;
  var expectedNodes = [
    { type: 'STAG', tag: cp.XYZ, localTagName: 'XYZ' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'TEXT', textContent: ' X & Y' },
        { type: 'TAG', tag: cp.BR, localTagName: 'BR' },
        { type: 'TEXT', textContent: ' X&#160;=&#160;1 ' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

// http://www.w3.org/TR/wbxml/#_Toc443384927
it('w3c expanded', function test_reader_w3c_expanded() {
  var data = binify([
    0x01, 0x01, 0x6A, 0x12,  'a',  'b',  'c', 0x00,  ' ',  'E',  'n',  't',
     'e',  'r',  ' ',  'n',  'a',  'm',  'e',  ':',  ' ', 0x00, 0x47, 0xC5,
    0x09, 0x83, 0x00, 0x05, 0x01, 0x88, 0x06, 0x86, 0x08, 0x03,  'x',  'y',
     'z', 0x00, 0x85, 0x03,  '/',  's', 0x00, 0x01, 0x83, 0x04, 0x86, 0x07,
    0x0A, 0x03,  'N', 0x00, 0x01, 0x01, 0x01
  ]);
  var codepages = {
    Default: {
      Tags: {
        CARD:  0x05,
        INPUT: 0x06,
        XYZ:   0x07,
        DO:    0x08,
      },
      Attrs: {
        STYLE:     { value: 0x05, data: 'LIST' },
        TYPE:      { value: 0x06 },
        TYPE_TEXT: { value: 0x07, name: 'TYPE', data: 'TEXT' },
        URL:       { value: 0x08, data: 'http://' },
        NAME:      { value: 0x09 },
        KEY:       { value: 0x0A },
        DOT_ORG:   { value: 0x85, data: '.org' },
        ACCEPT:    { value: 0x86, data: 'ACCEPT' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var cp = codepages.Default.Tags;
  var expectedNodes = [
    { type: 'STAG', tag: cp.XYZ, localTagName: 'XYZ' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { NAME: 'abc', STYLE: 'LIST' } },
        { type: 'TAG', tag: cp.DO, localTagName: 'DO',
          attributes: { TYPE: 'ACCEPT', URL: 'http://xyz.org/s' } },
        { type: 'TEXT', textContent: ' Enter name: ' },
        { type: 'TAG', tag: cp.INPUT, localTagName: 'INPUT',
          attributes: { TYPE: 'TEXT', KEY: 'N' } },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];

  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('processing instruction', function test_reader_pi() {
  // <?PI?>
  // <XYZ>
  //   <CARD>
  //     <?PI PREFIX?>
  //   </CARD>
  // </XYZ>
  // <?PI END?>
  var data = binify([
    0x01, 0x01, 0x03, 0x00, 0x43, 0x05, 0x01, 0x47, 0x46, 0x43, 0x06, 0x01,
    0x01, 0x01, 0x43, 0x05, 0x03,  'E',  'N',  'D', 0x00, 0x01
  ]);
  var codepages = {
    Default: {
      Tags: {
        BR:   0x05,
        CARD: 0x06,
        XYZ:  0x07,
      },
      Attrs: {
        PI:  { value: 0x05 },
        PI2: { value: 0x06, name: 'PI', data: 'PREFIX' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  var cp = codepages.Default.Tags;
  var expectedNodes = [
    { type: 'PI', target: 'PI', data: ''},
    { type: 'STAG', tag: cp.XYZ, localTagName: 'XYZ' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD' },
        { type: 'PI', target: 'PI', data: 'PREFIX' },
      { type: 'ETAG' },
    { type: 'ETAG' },
    { type: 'PI', target: 'PI', data: 'END' },
  ];

  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('literal tag', function test_reader_literal_tag() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
      },
      Attrs: {
        ATTR: { value: 0x05, data: 'VALUE' },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  var cp = codepages.Default.Tags;

  // <ROOT>
  //   <LITERAL/>
  // </ROOT>
  var data1 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x04, 0x00, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: undefined, localTagName: 'LITERAL' },
    { type: 'ETAG' },
  ];
  var r1 = new WBXML.Reader(data1, codepages);
  verify_document(r1, '1.1', 1, 'US-ASCII', expectedNodes);

  // <ROOT>
  //   <LITERAL>
  //     text
  //   </LITERAL>
  // </ROOT>
  var data2 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x44, 0x00, 0x03,  't',  'e',  'x',  't', 0x00, 0x01, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: undefined, localTagName: 'LITERAL' },
        { type: 'TEXT', textContent: 'text' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  var r2 = new WBXML.Reader(data2, codepages);
  verify_document(r2, '1.1', 1, 'US-ASCII', expectedNodes);

  // <ROOT>
  //   <LITERAL ATTR="VALUE"/>
  // </ROOT>
  var data3 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x84, 0x00, 0x05, 0x01, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: undefined, localTagName: 'LITERAL',
        attributes: { 'Default:ATTR': 'VALUE' } },
    { type: 'ETAG' },
  ];
  var r3 = new WBXML.Reader(data3, codepages);
  verify_document(r3, '1.1', 1, 'US-ASCII', expectedNodes);

  // <ROOT>
  //   <LITERAL ATTR="VALUE">
  //     text
  //   </LITERAL>
  // </ROOT>
  var data4 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0xC4, 0x00, 0x05, 0x01, 0x03,  't',  'e',  'x',  't', 0x00, 0x01,
    0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: undefined, localTagName: 'LITERAL',
        attributes: { 'Default:ATTR': 'VALUE' }},
        { type: 'TEXT', textContent: 'text' },
      { type: 'ETAG' },
    { type: 'ETAG' },
  ];
  var r4 = new WBXML.Reader(data4, codepages);
  verify_document(r4, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('literal attribute', function test_reader_literal_attribute() {
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

  // <ROOT>
  //   <CARD LITERAL/>
  //   <CARD LITERAL="value"/>
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x86, 0x04, 0x00, 0x01, 0x86, 0x04, 0x00, 0x03,  'v',  'a',  'l',
     'u',  'e', 0x00, 0x01, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { LITERAL: '' }},
      { type: 'TAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { LITERAL: 'value' }},
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('literal PI', function test_reader_literal_pi() {
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

  // <ROOT>
  //   <?LITERAL?>
  //   <?LITERAL value?>
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x43, 0x04, 0x00, 0x01, 0x43, 0x04, 0x00, 0x03,  'v',  'a',  'l',
     'u',  'e', 0x00, 0x01, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'PI', target: 'LITERAL', data: '' },
      { type: 'PI', target: 'LITERAL', data: 'value' },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('extension tag', function test_reader_extension_tag() {
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

  // <ROOT>
  //   (EXT_I_0 string)
  //   (EXT_T_1 42)
  //   (EXT_2)
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x40,  's',  't',  'r',  'i',  'n',  'g',
    0x00, 0x81, 0x2A, 0xC2, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'EXT', subtype: 'string', index: 0, value: 'string' },
      { type: 'EXT', subtype: 'integer', index: 1, value: 42 },
      { type: 'EXT', subtype: 'byte', index: 2, value: null },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('extension attr', function test_reader_extension_attr() {
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

  // <ROOT>
  //   <CARD TYPE="(EXT_I_0 string)"/>
  //   <CARD TYPE="vCard(EXT_T_1 42)"/>
  //   <CARD TYPE="LIST(EXT_2)"/>
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x86, 0x05, 0x40,  's',  't',  'r',  'i',
     'n',  'g', 0x00, 0x01, 0x86, 0x05, 0x03,  'v',  'C',  'a',  'r',  'd',
    0x00, 0x81, 0x2A, 0x01, 0x86, 0x06, 0xC2, 0x01, 0x01
  ]);
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
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('opaque', function test_reader_opaque() {
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

  // <ROOT>
  //   OPAQUE string
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0xC3, 0x06,  's',  't',  'r',  'i',  'n',
     'g', 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'OPAQUE', data: binify('string') },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'US-ASCII', expectedNodes);
});

it('utf8', function test_reader_utf8() {
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

  // <ROOT>
  //   <CARD TYPE="(angry guy)" CLASS="(biohazard)(flipped table)">
  //     (unicode snowman)
  //   </CARD>
  //   <CARD TYPE="(caduceus)" CLASS="(biohazard)(radiation)">
  //     (angry guy) (flipped table)
  //   </CARD>
  //   <(angry guy) (flipped table)="x"/>
  // </ROOT>
  var data = binify([
    0x01, 0x01, 0x6A, 0x1D,  '(', 0xE2, 0x95, 0xAF, 0xC2, 0xB0, 0xE2, 0x96,
    0xA1, 0xC2, 0xB0,  ')', 0xE2, 0x95, 0xAF, 0xEF, 0xB8, 0xB5, 0x00, 0xE2,
    0x94, 0xBB, 0xE2, 0x94, 0x81, 0xE2, 0x94, 0xBB, 0x00, 0x45, 0xC6, 0x05,
    0x83, 0x00, 0x06, 0x83, 0x13, 0x01, 0x03, 0xE2, 0x98, 0x83, 0x00, 0x01,
    0xC6, 0x05, 0x03, 0xE2, 0x98, 0xA4, 0x00, 0x06, 0x03, 0xE2, 0x98, 0xA2,
    0x00, 0x01, 0x83, 0x00, 0x03,  ' ', 0x00, 0x83, 0x13, 0x01, 0x84, 0x00,
    0x04, 0x13, 0x03,  'x', 0x00, 0x01, 0x01
  ]);
  var expectedNodes = [
    { type: 'STAG', tag: cp.ROOT, localTagName: 'ROOT' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35',
                      CLASS: '\u2623\u253b\u2501\u253b' }
      },
        { type: 'TEXT', textContent: '\u2603' },
      { type: 'ETAG' },
      { type: 'STAG', tag: cp.CARD, localTagName: 'CARD',
        attributes: { TYPE: '\u2624', CLASS: '\u2623\u2622' } },
        { type: 'TEXT', textContent: '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35 ' +
                                     '\u253b\u2501\u253b' },
      { type: 'ETAG' },
      { type: 'TAG', tag: undefined,
        localTagName: '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35',
        attributes: { '\u253b\u2501\u253b': 'x' } },
    { type: 'ETAG' },
  ];
  var r = new WBXML.Reader(data, codepages);
  verify_document(r, '1.1', 1, 'UTF-8', expectedNodes);
});

it('stray text', function test_reader_stray_text() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  // hi
  // <ROOT>
  //   <CARD/>
  // </ROOT>
  var data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x03, 'h', 'i', 0x00, 0x45, 0x06, 0x01
  ]);
  assert.throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD/>
  // </ROOT>
  // hi
  var data2 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x03, 'h', 'i', 0x00
  ]);
  assert.throws(function() {
    new WBXML.Reader(data2, codepages).dump();
  }, WBXML.ParseError);
});

it('stray etag', function test_reader_stray_etag() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  // <ROOT>
  //   <CARD/>
  // </ROOT>
  // </XXX>
  var data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x01
  ]);
  assert.throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);
});

it('multiple roots', function test_reader_multiple_roots() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  // <ROOT>
  //   <CARD/>
  // </ROOT>
  // <CARD/>
  var data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x06
  ]);
  assert.throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);
});

it('repeated attrs', function test_reader_repeated_attrs() {
  var codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
        CARD: 0x06,
      },
      Attrs: {
        TYPE: { value: 0x05 },
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  // <ROOT>
  //   <CARD TYPE="foo" TYPE="bar"/>
  // </ROOT>
  var data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x86, 0x05, 0x03,  'f',  'o',  'o', 0x00,
    0x05, 0x03,  'b',  'a',  'r', 0x00, 0x01, 0x01
  ]);
  assert.throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD LITERAL="foo" LITERAL="bar"/>
  // </ROOT>
  var data2 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x86, 0x04, 0x00, 0x03,  'f',  'o',  'o', 0x00, 0x04, 0x00, 0x03,
     'b',  'a',  'r', 0x00, 0x01, 0x01
  ]);
  assert.throws(function() {
    new WBXML.Reader(data2, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD TYPE="foo" TYPE="bar"/>
  // </ROOT>
  // <!-- TYPE="bar" is defined as a LITERAL -->
  var data3 = binify([
    0x01, 0x01, 0x03, 0x0D,  'D',  'e',  'f',  'a',  'u',  'l',  't',  ':',
     'T',  'Y',  'P',  'E', 0x00, 0x45, 0x86, 0x05, 0x03,  'f',  'o',  'o',
    0x00, 0x04, 0x00, 0x03,  'b',  'a',  'r', 0x00, 0x01, 0x01
  ]);
  assert.throws(function() {
    new WBXML.Reader(data3, codepages).dump();
  }, WBXML.ParseError);
});

}); // describe
