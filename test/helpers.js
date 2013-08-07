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

var chai = require('chai');
var assert = chai.assert;
// We want backtraces since we don't really use messages
chai.Assertion.includeStack = true;

function print(s) {
  var output = document.getElementById('output');
  output.textContent += s;
}

// Typed arrays don't compare well out of box; == and === don't work and deep
// equals will be too deep because it will go into the buffer instances,
// which is not what we want when we have created a subarray() since the
// semantic arrays can be equal but the backing buffers have no such constraint.
function assert_typedarrays_equal(a, b, path) {
  assert.equal(a.length, b.length);
  for (var i = 0; i < a.length; i++) {
    assert.equal(a[i], b[i], 'path: ' + path + ', typed array index ' + i);
  }
}

function assert_attr_equals(a, b, reason) {
  var attr_eq = function(a, b) {
    if (typeof a === 'object' && typeof b === 'object')
      return (a.type === b.type && a.subtype === b.subtype &&
              a.index === b.index && a.value === b.value);
    else
      return a == b;
  };

  var result;
  if (Array.isArray(a) && Array.isArray(b)) {
    result = (a.length === b.length);
    for (var i = 0; i < a.length; i++)
      result = result && attr_eq(a[i], b[i]);
  }
  else {
    result = attr_eq(a, b);
  }

  assert(result, reason ? reason : a + ' should be equal to ' + b);
}

function verify_node(actual, expected, path) {
  assert.equal(actual.type, expected.type);

  switch (actual.type) {
  case 'STAG':
  case 'TAG':
    assert.equal(actual.tag, expected.tag);
    assert.equal(actual.localTag, expected.tag && (expected.tag & 0xff));
    assert.equal(actual.namespace, expected.tag && (expected.tag >> 8));

    assert.equal(actual.localTagName, expected.localTagName);

    for (var attr in actual.attributes) {
      var splitName = attr.name.split(':');
      var namespace = splitName[0];
      var localName = splitName[1];
      assert.equal(attr.namespace, namespace);
      assert.equal(attr.localName, localName);

      var expectedAttr = expected.attributes[attr.name];
      if (expectedAttr === undefined && namespace === actual.namespaceName)
        expectedAttr = expected.attributes[attr.localName];

      assert_attr_equals(attr.value, expectedAttr);
    }

    if (expected.attributes) {
      for (var name in expected.attributes) {
        var value = expected.attributes[name];
        assert_attr_equals(actual.getAttribute(name), value);
      }
    }
    break;
  case 'TEXT':
    assert.equal(actual.textContent, expected.textContent);
    break;
  case 'PI':
    assert.equal(actual.target, expected.target);
    assert.equal(actual.data, expected.data);
    break;
  case 'EXT':
    assert.equal(actual.subtype, expected.subtype);
    assert.equal(actual.index, expected.index);
    assert.equal(actual.value, expected.value);
    break;
  case 'OPAQUE':
    // typed arrays need special handling because of views
    assert_typedarrays_equal(actual.data, expected.data, path);
    break;
  }
}


function verify_document(reader, expectedVersion, expectedPid, expectedCharset,
                         expectedNodes) {
  assert.equal(reader.version, expectedVersion, 'version mismatch');
  assert.equal(reader.pid, expectedPid, 'pid mismatch');
  assert.equal(reader.charset, expectedCharset, 'charset mismatch');

  assert.equal(reader.document.length, expectedNodes.length, 'node count');
  for (var i = 0; i < expectedNodes.length; i++) {
    var actual = reader.document[i];
    var expected = expectedNodes[i];
    assert.strictEqual(actual.ownerDocument, reader, 'owner mismatch');
    verify_node(actual, expected, '' + i);
  }
}

function verify_subdocument(actual, expected) {
  verify_node(actual, expected);
  if (actual.children || expected.children) {
    // 'children' may be omitted if empty; need to normalize
    var expectedKids = expected.children || [];
    assert.equal(actual.children.length, expectedKids.length);
    for (var i = 0; i < actual.children.length; i++) {
      var actualChild = actual.children[i];
      var expectedChild = expectedKids[i];
      verify_subdocument(actualChild, expectedChild);
    }
  }
}

/**
 * Create a typed array from an array or a string that we treat as a binary
 * string.
 */
function binify(src) {
  var dest = new Uint8Array(src.length);
  for (var i = 0; i < src.length; i++) {
    if (typeof src[i] === 'number')
      dest[i] = src[i];
    else if (typeof src[i] === 'string')
      dest[i] = src[i].charCodeAt(0);
    else
      throw 'bad value';
  }
  return dest;
}

exports.verify_document = verify_document;
exports.verify_subdocument = verify_subdocument;
exports.binify = binify;
