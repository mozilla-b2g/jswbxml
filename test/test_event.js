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

function test_event_basic() {
  let codepages = {
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
  let cp = codepages.Default.Tags;
  let cpa = codepages.Default.Attrs;

  let a = WBXML.Writer.a;

  let w1 = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w1.stag(cp.ROOT)
      .tag(cp.CARD)
    .etag();

  let expectedSubdoc1 = { type: 'TAG', tag: cp.CARD, localTagName: 'CARD' };

  let e1 = new WBXML.EventParser();
  e1.addEventListener([cp.ROOT, cp.CARD], function(subdoc) {
    verify_subdocument(subdoc, expectedSubdoc1);
  });
  e1.run(new WBXML.Reader(w1, codepages));

  let w2 = new WBXML.Writer('1.1', 1, 'US-ASCII');
  w2.stag(cp.ROOT)
      .stag(cp.CARD)
        .tag(cp.FIELD, a(cpa.TYPE, 'NAME'), 'Anne')
        .text('anne@anne.com')
      .etag()
    .etag();

  let expectedSubdoc2 =
    { type: 'TAG', tag: cp.CARD, localTagName: 'CARD', children: [
      { type: 'TAG', tag: cp.FIELD, localTagName: 'FIELD',
        attributes: { TYPE: 'NAME' }, children: [
          { type: 'TEXT', textContent: 'Anne' },
        ] },
      { type: 'TEXT', textContent: 'anne@anne.com' },
    ]};

  let e2 = new WBXML.EventParser();
  e2.addEventListener([cp.ROOT, cp.CARD], function(subdoc) {
    verify_subdocument(subdoc, expectedSubdoc2);
  });
  e2.run(new WBXML.Reader(w2, codepages));
}
