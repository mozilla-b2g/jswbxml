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

function binify(src) {
  let dest = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) {
    if (typeof src[i] == "number")
      dest[i] = src[i];
    else if (typeof src[i] == "string")
      dest[i] = src[i].charCodeAt(0);
    else
      throw "bad value";
  }
  return dest;
}

function print(s) {
  let output = document.getElementById("output");
  output.textContent += s;
}

function assert(expr, reason) {
  if (!expr)
    throw new Error(reason);
}

function assert_equals(a, b, reason) {
  assert(a == b, reason ? reason : a + " should be equal to " + b);
}

function assert_throws(f, type) {
  let threw = false;
  try {
    f();
  }
  catch (e if !type || e instanceof type) {
    threw = true;
  }
  if (!threw)
    throw new Error("exception expected, but not found");
}

/**
 * Zip some iterators together to walk through them in lock-step.
 */
function zip() {
  while (true) {
    let ends = 0;
    let step = []
    for (let i = 0; i < arguments.length; i++) {
      try {
        step.push(arguments[i].next());
      } catch (e if e instanceof StopIteration) {
        ends++;
      }
    }
    if (ends == arguments.length)
      throw StopIteration;
    else if (ends != 0)
      throw new Error("Zipped iterators have differing lengths!");

    yield step;
  }
}

function verify_wbxml(reader, expectedVersion, expectedPid, expectedCharset,
                      expectedNodes) {
  assert_equals(reader.version, expectedVersion);
  assert_equals(reader.pid, expectedPid);
  assert_equals(reader.charset, expectedCharset);

  for (let [node, expected] in
       zip( reader.document, (expectedNodes[i] for (i in expectedNodes)) )) {
    assert_equals(node.type, expected.type);

    switch (node.type) {
    case "STAG":
    case "TAG":
      assert_equals(node.tag, expected.tag);
      assert_equals(node.localTag, expected.tag && (expected.tag & 0xff));
      assert_equals(node.namespace, expected.tag && (expected.tag >> 8));

      assert_equals(node.localTagName, expected.localTagName);

      for (let [name, value] in node.attributes)
        assert_equals(value, expected.attributes[name]);

      if (expected.attributes) {
        for (let [name, value] in Iterator(expected.attributes))
          assert_equals(value, node.getAttribute(name));
      }
      break;
    case "TEXT":
      assert_equals(node.textContent, expected.textContent);
      break;
    case "PI":
      assert_equals(node.target, expected.target);
      assert_equals(node.data, expected.data);
      break;
    case "EXT":
      assert_equals(node.subtype, expected.subtype);
      assert_equals(node.index, expected.index);
      assert_equals(node.value, expected.value);
      break;
    case "OPAQUE":
      assert_equals(node.data, expected.data);
    }
  }
}

// http://www.w3.org/TR/wbxml/#_Toc443384926
function test_w3c_simple() {
  let data = binify([
    0x01, 0x01, 0x03, 0x00, 0x47, 0x46, 0x03,  ' ',  'X',  ' ',  '&',  ' ',
     'Y', 0x00, 0x05, 0x03,  ' ',  'X', 0x00, 0x02, 0x81, 0x20, 0x03,  '=',
    0x00, 0x02, 0x81, 0x20, 0x03,  '1',  ' ', 0x00, 0x01, 0x01
  ]);
  let codepages = {
    Default: {
      Tags: {
        BR:   0x05,
        CARD: 0x06,
        XYZ:  0x07,
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  let cp = codepages.Default.Tags;
  let expectedNodes = [
    { type: "STAG", tag: cp.XYZ, localTagName: "XYZ" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD" },
        { type: "TEXT", textContent: " X & Y" },
        { type: "TAG", tag: cp.BR, localTagName: "BR" },
        { type: "TEXT", textContent: " X&#160;=&#160;1 " },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

// http://www.w3.org/TR/wbxml/#_Toc443384927
function test_w3c_expanded() {
  let data = binify([
    0x01, 0x01, 0x6A, 0x12,  'a',  'b',  'c', 0x00,  ' ',  'E',  'n',  't',
     'e',  'r',  ' ',  'n',  'a',  'm',  'e',  ':',  ' ', 0x00, 0x47, 0xC5,
    0x09, 0x83, 0x00, 0x05, 0x01, 0x88, 0x06, 0x86, 0x08, 0x03,  'x',  'y',
     'z', 0x00, 0x85, 0x03,  '/',  's', 0x00, 0x01, 0x83, 0x04, 0x86, 0x07,
    0x0A, 0x03,  'N', 0x00, 0x01, 0x01, 0x01
  ]);
  let codepages = {
    Default: {
      Tags: {
        CARD:  0x05,
        INPUT: 0x06,
        XYZ:   0x07,
        DO:    0x08,
      },
      Attrs: {
        STYLE:     { value: 0x05, data: "LIST" },
        TYPE:      { value: 0x06 },
        TYPE_TEXT: { value: 0x07, name: "TYPE", data: "TEXT" },
        URL:       { value: 0x08, data: "http://" },
        NAME:      { value: 0x09 },
        KEY:       { value: 0x0A },
        DOT_ORG:   { value: 0x85, data: ".org" },
        ACCEPT:    { value: 0x86, data: "ACCEPT" },
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  let cp = codepages.Default.Tags;
  let expectedNodes = [
    { type: "STAG", tag: cp.XYZ, localTagName: "XYZ" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { NAME: "abc", STYLE: "LIST" } },
        { type: "TAG", tag: cp.DO, localTagName: "DO",
          attributes: { TYPE: "ACCEPT", URL: "http://xyz.org/s" } },
        { type: "TEXT", textContent: " Enter name: " },
        { type: "TAG", tag: cp.INPUT, localTagName: "INPUT",
          attributes: { TYPE: "TEXT", KEY: "N" } },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "UTF-8", expectedNodes);
}

/*// http://msdn.microsoft.com/en-us/library/ee237245%28v=exchg.80%29
function test_activesync() {
  let data = binify([
    0x03, 0x01, 0x6A, 0x00, 0x45, 0x5C, 0x4F, 0x50, 0x03, 0x43, 0x6F, 0x6E,
    0x74, 0x61, 0x63, 0x74, 0x73, 0x00, 0x01, 0x4B, 0x03, 0x32, 0x00, 0x01,
    0x52, 0x03, 0x32, 0x00, 0x01, 0x4E, 0x03, 0x31, 0x00, 0x01, 0x56, 0x47,
    0x4D, 0x03, 0x32, 0x3A, 0x31, 0x00, 0x01, 0x5D, 0x00, 0x11, 0x4A, 0x46,
    0x03, 0x31, 0x00, 0x01, 0x4C, 0x03, 0x30, 0x00, 0x01, 0x4D, 0x03, 0x31,
    0x00, 0x01, 0x01, 0x00, 0x01, 0x5E, 0x03, 0x46, 0x75, 0x6E, 0x6B, 0x2C,
    0x20, 0x44, 0x6F, 0x6E, 0x00, 0x01, 0x5F, 0x03, 0x44, 0x6F, 0x6E, 0x00,
    0x01, 0x69, 0x03, 0x46, 0x75, 0x6E, 0x6B, 0x00, 0x01, 0x00, 0x11, 0x56,
    0x03, 0x31, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01
  ]);

  let as = ActiveSync.AirSync.Tags;
  let asb = ActiveSync.AirSyncBase.Tags;
  let c = ActiveSync.Contacts.Tags;
  let expectedNodes = [
    { type: "STAG", tag: as.Sync, localTagName: "Sync" },
      { type: "STAG", tag: as.Collections, localTagName: "Collections" },
        { type: "STAG", tag: as.Collection, localTagName: "Collection" },
          { type: "STAG", tag: as.Class, localTagName: "Class" },
            { type: "TEXT", textContent: "Contacts" },
          { type: "ETAG" },
          { type: "STAG", tag: as.SyncKey, localTagName: "SyncKey" },
            { type: "TEXT", textContent: "2" },
          { type: "ETAG" },
          { type: "STAG", tag: as.CollectionId, localTagName: "CollectionId" },
            { type: "TEXT", textContent: "2" },
          { type: "ETAG" },
          { type: "STAG", tag: as.Status, localTagName: "Status" },
            { type: "TEXT", textContent: "1" },
          { type: "ETAG" },

          { type: "STAG", tag: as.Commands, localTagName: "Commands" },
            { type: "STAG", tag: as.Add, localTagName: "Add" },
              { type: "STAG", tag: as.ServerId, localTagName: "ServerId" },
                { type: "TEXT", textContent: "2:1" },
              { type: "ETAG" },
              { type: "STAG", tag: as.ApplicationData, localTagName: "ApplicationData" },
                { type: "STAG", tag: asb.Body, localTagName: "Body" },
                  { type: "STAG", tag: asb.Type, localTagName: "Type" },
                    { type: "TEXT", textContent: "1" },
                  { type: "ETAG" },
                  { type: "STAG", tag: asb.EstimatedDataSize, localTagName: "EstimatedDataSize" },
                    { type: "TEXT", textContent: "0" },
                  { type: "ETAG" },
                  { type: "STAG", tag: asb.Truncated, localTagName: "Truncated" },
                    { type: "TEXT", textContent: "1" },
                  { type: "ETAG" },
                { type: "ETAG" },
                { type: "STAG", tag: c.FileAs, localTagName: "FileAs" },
                  { type: "TEXT", textContent: "Funk, Don" },
                { type: "ETAG" },
                { type: "STAG", tag: c.FirstName, localTagName: "FirstName" },
                  { type: "TEXT", textContent: "Don" },
                { type: "ETAG" },
                { type: "STAG", tag: c.LastName, localTagName: "LastName" },
                  { type: "TEXT", textContent: "Funk" },
                { type: "ETAG" },
                { type: "STAG", tag: asb.NativeBodyType, localTagName: "NativeBodyType" },
                  { type: "TEXT", textContent: "1" },
                { type: "ETAG" },
              { type: "ETAG" },
            { type: "ETAG" },
          { type: "ETAG" },
        { type: "ETAG" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(data, ActiveSync);
  verify_wbxml(r, "1.3", 1, "UTF-8", expectedNodes);
}*/

function test_pi() {
  // <?PI?>
  // <XYZ>
  //   <CARD>
  //     <?PI PREFIX?>
  //   </CARD>
  // </XYZ>
  // <?PI END?>
  let data = binify([
    0x01, 0x01, 0x03, 0x00, 0x43, 0x05, 0x01, 0x47, 0x46, 0x43, 0x06, 0x01,
    0x01, 0x01, 0x43, 0x05, 0x03,  'E',  'N',  'D', 0x00, 0x01
  ]);
  let codepages = {
    Default: {
      Tags: {
        BR:   0x05,
        CARD: 0x06,
        XYZ:  0x07,
      },
      Attrs: {
        PI:  { value: 0x05 },
        PI2: { value: 0x06, name: "PI", data: "PREFIX" },
      },
    }
  };
  WBXML.CompileCodepages(codepages);

  let cp = codepages.Default.Tags;
  let expectedNodes = [
    { type: "PI", target: "PI", data: ""},
    { type: "STAG", tag: cp.XYZ, localTagName: "XYZ" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD" },
        { type: "PI", target: "PI", data: "PREFIX" },
      { type: "ETAG" },
    { type: "ETAG" },
    { type: "PI", target: "PI", data: "END" },
  ];

  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_literal_tag() {
  let codepages = {
    Default: {
      Tags: {
        ROOT: 0x05,
      },
      Attrs: {
        ATTR: { value: 0x05, data: "VALUE" },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;

  // <ROOT>
  //   <LITERAL/>
  // </ROOT>
  let data1 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x04, 0x00, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "TAG", tag: undefined, localTagName: "LITERAL" },
    { type: "ETAG" },
  ];
  let r1 = new WBXML.Reader(data1, codepages);
  verify_wbxml(r1, "1.1", 1, "US-ASCII", expectedNodes);

  // <ROOT>
  //   <LITERAL>
  //     text
  //   </LITERAL>
  // </ROOT>
  let data2 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x44, 0x00, 0x03,  't',  'e',  'x',  't', 0x00, 0x01, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "STAG", tag: undefined, localTagName: "LITERAL" },
        { type: "TEXT", textContent: "text" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];
  let r2 = new WBXML.Reader(data2, codepages);
  verify_wbxml(r2, "1.1", 1, "US-ASCII", expectedNodes);

  // <ROOT>
  //   <LITERAL ATTR="VALUE"/>
  // </ROOT>
  let data3 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x84, 0x00, 0x05, 0x01, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "TAG", tag: undefined, localTagName: "LITERAL",
        attributes: { ATTR: "VALUE" } },
    { type: "ETAG" },
  ];
  let r3 = new WBXML.Reader(data3, codepages);
  verify_wbxml(r3, "1.1", 1, "US-ASCII", expectedNodes);

  // <ROOT>
  //   <LITERAL ATTR="VALUE">
  //     text
  //   </LITERAL>
  // </ROOT>
  let data4 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0xC4, 0x00, 0x05, 0x01, 0x03,  't',  'e',  'x',  't', 0x00, 0x01,
    0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "STAG", tag: undefined, localTagName: "LITERAL",
        attributes: { ATTR: "VALUE" }},
        { type: "TEXT", textContent: "text" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];
  let r4 = new WBXML.Reader(data4, codepages);
  verify_wbxml(r4, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_literal_attribute() {
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

  // <ROOT>
  //   <CARD LITERAL/>
  //   <CARD LITERAL="value"/>
  // </ROOT>
  let data = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x86, 0x04, 0x00, 0x01, 0x86, 0x04, 0x00, 0x03,  'v',  'a',  'l',
     'u',  'e', 0x00, 0x01, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "TAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { LITERAL: "" }},
      { type: "TAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { LITERAL: "value" }},
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_literal_pi() {
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

  // <ROOT>
  //   <?LITERAL?>
  //   <?LITERAL value?>
  // </ROOT>
  let data = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x43, 0x04, 0x00, 0x01, 0x43, 0x04, 0x00, 0x03,  'v',  'a',  'l',
     'u',  'e', 0x00, 0x01, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "PI", target: "LITERAL", data: "" },
      { type: "PI", target: "LITERAL", data: "value" },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_extension_tag() {
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

  // <ROOT>
  //   EXT_I_0 string
  //   EXT_T_1 42
  //   EXT_2
  // </ROOT>
  let data = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x40,  's',  't',  'r',  'i',  'n',  'g',
    0x00, 0x81, 0x2A, 0xC2, 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "EXT", subtype: "string", index: 0, value: "string" },
      { type: "EXT", subtype: "integer", index: 1, value: 42 },
      { type: "EXT", subtype: "byte", index: 2, value: null },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_opaque() {
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

  // <ROOT>
  //   OPAQUE string
  // </ROOT>
  let data = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0xC3, 0x06,  's',  't',  'r',  'i',  'n',
     'g', 0x01
  ]);
  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "OPAQUE", data: "string" },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(data, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

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

  let w = new WBXML.Writer("1.1", 1, 3);
  let cp = codepages.Default.Tags;
  w.stag(cp.ROOT)
     .tag(cp.CARD, "0")
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD" },
        { type: "TEXT", textContent: "0" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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
        VCARD:   { value: 0x85, data: "vCard" },
        DOT_COM: { value: 0x86, data: ".com" },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;

  let w = new WBXML.Writer("1.1", 1, 3);
  w.stag(cp.ROOT, a(cpa.TYPE, "list"))
     .tag(cp.CARD, a(cpa.TYPE, cpa.VCARD),
                   a(cpa.EMAIL, ["foo@bar", cpa.DOT_COM]))
     .tag(cp.CARD, a(cpa.TYPE, cpa.VCARD),
                   a(cpa.EMAIL, ["bob@bob", cpa.DOT_COM]), "Bob")
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT",
      attributes: { TYPE: "list" } },
      { type: "TAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { TYPE: "vCard", EMAIL: "foo@bar.com" } },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { TYPE: "vCard", EMAIL: "bob@bob.com" } },
        { type: "TEXT", textContent: "Bob" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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

  let w = new WBXML.Writer("1.1", 1, 3, ["list", "@example.com", "foo", ", "]);
  w.stag(cp.ROOT, a(cpa.TYPE, str_t(0)))
     .tag(cp.CARD, a(cpa.EMAIL, [str_t(18), str_t(5)]), str_t(18))
     .tag(cp.CARD, a(cpa.EMAIL, ["ted", str_t(5)]),
          ["Danson", str_t(22), "Ted"])
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT",
      attributes: { TYPE: "list" } },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { EMAIL: "foo@example.com" } },
        { type: "TEXT", textContent: "foo" },
      { type: "ETAG" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD",
        attributes: { EMAIL: "ted@example.com" } },
        { type: "TEXT", textContent: "Danson, Ted" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];

  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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

  let w = new WBXML.Writer("1.1", 1, 3);
  w.stag(cp.ROOT)
    .tag(cp.CARD, ["Ted", ent(160), "Danson"])
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD" },
        { type: "TEXT", textContent: "Ted&#160;Danson" },
      { type: "ETAG" },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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
        PI2: { value: 0x06, name: "PI", data: "PREFIX" },
      },
    }
  };
  WBXML.CompileCodepages(codepages);
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let w = new WBXML.Writer("1.1", 1, 3);
  w.pi(cpa.PI)
   .stag(cp.ROOT)
     .stag(cp.CARD)
     .pi(cpa.PI2)
     .etag()
   .etag()
   .pi(cpa.PI, "END");

  let expectedNodes = [
    { type: "PI", target: "PI", data: ""},
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "STAG", tag: cp.CARD, localTagName: "CARD" },
        { type: "PI", target: "PI", data: "PREFIX" },
      { type: "ETAG" },
    { type: "ETAG" },
    { type: "PI", target: "PI", data: "END" },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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

  let w = new WBXML.Writer("1.1", 1, 3);
  w.stag(cp.ROOT)
     .ext("string", 0, "string")
     .ext("integer", 1, 42)
     .ext("byte", 2)
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "EXT", subtype: "string", index: 0, value: "string" },
      { type: "EXT", subtype: "integer", index: 1, value: 42 },
      { type: "EXT", subtype: "byte", index: 2, value: null },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
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

  let w = new WBXML.Writer("1.1", 1, 3);
  w.stag(cp.ROOT)
     .opaque("string")
     .opaque(binify("string"))
   .etag();

  let expectedNodes = [
    { type: "STAG", tag: cp.ROOT, localTagName: "ROOT" },
      { type: "OPAQUE", data: "string" },
      { type: "OPAQUE", data: "string" },
    { type: "ETAG" },
  ];
  let r = new WBXML.Reader(w, codepages);
  verify_wbxml(r, "1.1", 1, "US-ASCII", expectedNodes);
}

function test_stray_text() {
  let codepages = {
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
  let data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x03, 'h', 'i', 0x00, 0x45, 0x06, 0x01
  ]);
  assert_throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD/>
  // </ROOT>
  // hi
  let data2 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x03, 'h', 'i', 0x00
  ]);
  assert_throws(function() {
    new WBXML.Reader(data2, codepages).dump();
  }, WBXML.ParseError);
}

function test_stray_etag() {
  let codepages = {
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
  let data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x01
  ]);
  assert_throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);
}

function test_multiple_roots() {
  let codepages = {
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
  let data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x06, 0x01, 0x06
  ]);
  assert_throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);
}

function test_repeated_attrs() {
  let codepages = {
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
  let data1 = binify([
    0x01, 0x01, 0x03, 0x00, 0x45, 0x86, 0x05, 0x03,  'f',  'o',  'o', 0x00,
    0x05, 0x03,  'b',  'a',  'r', 0x00, 0x01, 0x01
  ]);
  assert_throws(function() {
    new WBXML.Reader(data1, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD LITERAL="foo" LITERAL="bar"/>
  // </ROOT>
  let data2 = binify([
    0x01, 0x01, 0x03, 0x08,  'L',  'I',  'T',  'E',  'R',  'A',  'L', 0x00,
    0x45, 0x86, 0x04, 0x00, 0x03,  'f',  'o',  'o', 0x00, 0x04, 0x00, 0x03,
     'b',  'a',  'r', 0x00, 0x01, 0x01
  ]);
  assert_throws(function() {
    new WBXML.Reader(data2, codepages).dump();
  }, WBXML.ParseError);

  // <ROOT>
  //   <CARD TYPE="foo" TYPE="bar"/>
  // </ROOT>
  // <!-- TYPE="bar" is defined as a LITERAL -->
  let data3 = binify([
    0x01, 0x01, 0x03, 0x05,  'T',  'Y',  'P',  'E', 0x00, 0x45, 0x86, 0x05,
    0x03,  'f',  'o',  'o', 0x00, 0x04, 0x00, 0x03,  'b',  'a',  'r', 0x00,
    0x01, 0x01
  ]);
  assert_throws(function() {
    new WBXML.Reader(data3, codepages).dump();
  }, WBXML.ParseError);
}

window.addEventListener("load", function() {
  let pass = 0, fail = 0;
  for (let i in window) {
    if (i.match(/^test_/)) {
      try {
        window[i]();
        print(i + " PASSED\n");
        pass++;
      }
      catch(e) {
        print(i + " FAILED: " + e + "\n");
        print(e.stack.replace(/^(.)/mg, "  $1"));
        fail++;
      }
    }
  }

  print("\nPassed: " + pass + " Failed: " + fail + "\n");
}, false);
