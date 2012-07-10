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

const WBXMLTokens = {
  SWITCH_PAGE: 0x00,
  END:         0x01,
  ENTITY:      0x02,
  STR_I:       0x03,
  LITERAL:     0x04,
  EXT_I_0:     0x40,
  EXT_I_1:     0x41,
  EXT_I_2:     0x42,
  PI:          0x43,
  LITERAL_C:   0x44,
  EXT_T_0:     0x80,
  EXT_T_1:     0x81,
  EXT_T_2:     0x82,
  STR_T:       0x83,
  LITERAL_A:   0x84,
  EXT_0:       0xC0,
  EXT_1:       0xC1,
  EXT_2:       0xC2,
  OPAQUE:      0xC3,
  LITERAL_AC:  0xC4,
};

function WBXMLParseError(message) {
    this.name = "WBXMLParseError";
    this.message = message || "";
}
WBXMLParseError.prototype = new Error();
WBXMLParseError.prototype.constructor = WBXMLParseError;

function StringTable(data) {
  this.strings = data.split("\0");
  this.offsets = {};
  let total = 0;
  for (let i = 0; i < this.strings.length; i++) {
    this.offsets[total] = i;
    // Add 1 to the current string's length here because we stripped a null-
    // terminator earlier.
    total += this.strings[i].length + 1;
  }
}

StringTable.prototype = {
  get: function(offset) {
    if (offset in this.offsets)
      return this.strings[this.offsets[offset]];
    else {
      if (offset < 0)
        throw new WBXMLParseError("offset must be >= 0");

      let curr = 0;
      for (let i = 0; i < this.strings.length; i++) {
        // Add 1 to the current string's length here because we stripped a null-
        // terminator earlier.
        if (offset < curr + this.strings[i].length + 1)
          return this.strings[i].slice(offset - curr);
        curr += this.strings[i].length + 1;
      }
    }
    throw new WBXMLParseError("invalid offset");
  },
};

const MIBenum = {
    3: "US-ASCII",
    4: "ISO-8859-1",
    5: "ISO-8859-2",
    6: "ISO-8859-3",
    7: "ISO-8859-4",
    8: "ISO-8859-5",
    9: "ISO-8859-6",
   10: "ISO-8859-7",
   11: "ISO-8859-8",
   12: "ISO-8859-9",
   13: "ISO-8859-10",
  106: "UTF-8",
};

function WBXMLElement(type, tag, codepages) {
  this.type = type;
  if (typeof tag == "string")
    this._tagName = tag;
  else
    this.tag = tag;
  this._codepages = codepages;
  this._attrs = {};
}

WBXMLElement.prototype = {
  get namespace() this.tag && (this.tag >> 8),
  get localTag() this.tag && (this.tag & 0xff),

  /* TODO: support LITERAL namespaces; also maybe move those into a separate
     type? */
  get namespaceName() {
    if (this._tagName)
      return null;
    return this._codepages.__nsnames__[this.namespace];
  },
  get localTagName() this._tagName || this._codepages.__tagnames__[this.tag],
  get tagName() {
    let ns = this.namespaceName;
    ns = ns ? ns + ":" : "";
    return ns + this.localTagName;
  },

  get attributes() {
    for (let [name, pieces] in Iterator(this._attrs))
      yield [name, this._getAttribute(pieces)];
  },

  getAttribute: function(attr) {
    if (typeof attr == "number")
      attr = this._codepages.__attrdata__[attr].name;
    return this._getAttribute(this._attrs[attr]);
  },

  _getAttribute: function(pieces) {
    let value = "";

    for (let [,hunk] in Iterator(pieces)) {
      if (hunk instanceof WBXMLExtension)
        throw new Error("TODO: support WBXML extension tokens in attributes");
      else if (typeof hunk == "number")
        value += this._codepages.__attrdata__[hunk].data || "";
      else
        value += hunk;
    }

    return value;
  },

  _addAttribute: function(attr) {
    if (typeof attr == "string") {
      if (attr in this._attrs)
        throw new WBXMLParseError("attribute "+attr+" is repeated");
      return this._attrs[attr] = [];
    }
    else {
      // TODO: qualify with namespace
      let name = this._codepages.__attrdata__[attr].name;
      if (name in this._attrs)
        throw new WBXMLParseError("attribute "+name+" is repeated");
      return this._attrs[name] = [attr];
    }
  },
};

function WBXMLEndTag() {}

WBXMLEndTag.prototype = {
  get type() "ETAG",
};

function WBXMLText(textContent) {
  this.textContent = textContent;
}

WBXMLText.prototype = {
  get type() "TEXT",
};

function WBXMLExtension(subtype, index, value) {
  this.subtype = subtype;
  this.index = index;
  this.value = value;
}

WBXMLExtension.prototype = {
  get type() "EXT",
};

function WBXMLProcessingInstruction(codepages) {
  this._codepages = codepages;
}

WBXMLProcessingInstruction.prototype = {
  get type() "PI",

  get target() {
    if (typeof this.targetID == "string")
      return this.targetID;
    else
      return this._codepages.__attrdata__[this.targetID].name;
  },

  _setTarget: function(target) {
    this.targetID = target;
    if (typeof target == "string")
      return this._data = [];
    else
      return this._data = [target];
  },

  // TODO: this seems impolite...
  _getAttribute: WBXMLElement.prototype._getAttribute,

  get data() this._getAttribute(this._data),
};

function WBXMLOpaque(data) {
  this.data = data;
}

WBXMLOpaque.prototype = {
  get type() "OPAQUE",
};

function WBXMLReader(xml, codepages) {
  this._xml = xml instanceof WBXMLWriter ? xml.bytes : xml;
  this._codepages = codepages;
  this.rewind();
}

WBXMLReader.prototype = {
  _get_uint8: function() {
    return this._iter.next();
  },

  _get_mb_uint32: function() {
    let b;
    let result = 0;
    do {
      b = this._iter.next();
      result = result*128 + (b & 0x7f);
    } while(b & 0x80);
    return result;
  },

  rewind: function() {
    let self = this;
    // For some reason, the normal generator syntax doesn't work when |xml| is
    // a member variable, so do it like this.
    this._iter = (function() {
      for (let i = 0; i < self._xml.length; i++)
        yield self._xml[i];
    })();

    // TODO: only do this once during the constructor?
    let v = this._get_uint8();
    this.version = ((v & 0xf0) + 1).toString() + "." + (v & 0x0f).toString();
    this.pid = this._get_mb_uint32();
    this.charset = MIBenum[this._get_mb_uint32()] || "unknown";

    let tbl_len = this._get_mb_uint32();
    let s = "";
    for (let j = 0; j < tbl_len; j++)
      s += String.fromCharCode(this._get_uint8());
    this.strings = new StringTable(s);
  },

  // start        = version publicid charset strtbl body
  // strtbl       = length *byte
  // body         = *pi element *pi
  // element      = stag [ 1*attribute END ] [ *content END ]
  //
  // content      = element | string | extension | entity | pi | opaque
  //
  // stag         = TAG | ( LITERAL index )
  // attribute    = attrStart *attrValue
  // attrStart    = ATTRSTART | ( LITERAL index )
  // attrValue    = ATTRVALUE | string | extension | entity
  //
  // extension    = ( EXT_I termstr ) | ( EXT_T index ) | EXT
  //
  // string       = inline | tableref
  // inline       = STR_I termstr
  // tableref     = STR_T index
  //
  // entity       = ENTITY entcode
  // entcode      = mb_u_int32            // UCS-4 character code
  //
  // pi           = PI attrStart *attrValue END
  //
  // opaque       = OPAQUE length *byte
  //
  // version      = u_int8 containing WBXML version number
  // publicid     = mb_u_int32 | ( zero index )
  // charset      = mb_u_int32
  // termstr      = charset-dependent string with termination
  // index        = mb_u_int32            // integer index into string table.
  // length       = mb_u_int32            // integer length.
  // zero         = u_int8                // containing the value zero (0).
  get document() {
    const Tokens = WBXMLTokens;

    // Parser states
    const States = {
      BODY: 0,
      ATTRIBUTES: 1,
      ATTRIBUTE_PI: 2,
    };

    let state = States.BODY;
    let currentNode;
    let currentAttr;
    let codepage = 0;
    let depth = 0;
    let foundRoot = false;

    let appendString = function(s) {
      if (state == States.BODY) {
        if (!currentNode)
          currentNode = new WBXMLText(s);
        else
          currentNode.textContent += s;
      }
      else { // if (state == States.ATTRIBUTES || state == States.ATTRIBUTE_PI)
        currentAttr.push(s);
      }
      // We can assume that we're in a valid state, so don't bother checking
      // here.
    };

    for (let tok in this._iter) {
      if (tok == Tokens.SWITCH_PAGE) {
        codepage = this._get_uint8();
        if (!(codepage in this._codepages.__nsnames__))
          throw new WBXMLParseError("unknown codepage "+codepage)
      }
      else if (tok == Tokens.END) {
        if (state == States.BODY && depth-- > 0) {
          if (currentNode) {
            yield currentNode;
            currentNode = null;
          }
          yield new WBXMLEndTag();
        }
        else if (state == States.ATTRIBUTES || state == States.ATTRIBUTE_PI) {
          state = States.BODY;

          yield currentNode;
          currentNode = null;
          currentAttr = null;
        }
        else {
          throw new WBXMLParseError("unexpected END token");
        }
      }
      else if (tok == Tokens.ENTITY) {
        if (state == States.BODY && depth == 0)
          throw new WBXMLParseError("unexpected ENTITY token");
        let e = this._get_mb_uint32();
        appendString("&#"+e+";");
      }
      else if (tok == Tokens.STR_I) {
        if (state == States.BODY && depth == 0)
          throw new WBXMLParseError("unexpected STR_I token");
        let s = "";
        let c;
        while ( (c = this._get_uint8()) ) {
          s += String.fromCharCode(c);
        }
        appendString(s);
      }
      else if (tok == Tokens.PI) {
        if (state != States.BODY)
          throw new WBXMLParseError("unexpected PI token");
        state = States.ATTRIBUTE_PI;

        if (currentNode)
          yield currentNode;
        currentNode = new WBXMLProcessingInstruction(this._codepages);
      }
      else if (tok == Tokens.STR_T) {
        if (state == States.BODY && depth == 0)
          throw new WBXMLParseError("unexpected STR_T token");
        let r = this._get_mb_uint32();
        appendString(this.strings.get(r));
      }
      else if (tok == Tokens.OPAQUE) {
        if (state != States.BODY)
          throw new WBXMLParseError("unexpected OPAQUE token");
        let len = this._get_mb_uint32();
        let s = ""; // TODO: use a typed array here?
        for (let i = 0; i < len; i++)
          s += String.fromCharCode(this._get_uint8());

        if (currentNode) {
          yield currentNode;
          currentNode = null;
        }
        yield new WBXMLOpaque(s);
      }
      else if (((tok & 0x40) || (tok & 0x80)) && (tok & 0x3f) < 3) {
        let hi = tok & 0xc0;
        let lo = tok & 0x3f;
        let subtype;
        let value;

        if (hi == Tokens.EXT_I_0) {
          subtype = "string";
          value = "";
          let c;
          while ( (c = this._get_uint8()) ) {
            value += String.fromCharCode(c);
          }
        }
        else if (hi == Tokens.EXT_T_0) {
          subtype = "integer";
          value = this._get_mb_uint32();
        }
        else { // if (hi == Tokens.EXT_0)
          subtype = "byte";
          value = null;
        }

        let ext = new WBXMLExtension(subtype, lo, value);
        if (state == States.BODY) {
          if (currentNode) {
            yield currentNode;
            currentNode = null;
          }
          yield ext;
        }
        else { // if (state == States.ATTRIBUTES || state == States.ATTRIBUTE_PI)
          currentAttr.push(ext);
        }
      }
      else if (state == States.BODY) {
        if (depth == 0) {
          if (foundRoot)
            throw new WBXMLParseError("multiple root nodes found");
          foundRoot = true;
        }

        let tag = (codepage << 8) + (tok & 0x3f);
        if ((tok & 0x3f) == Tokens.LITERAL) {
          let r = this._get_mb_uint32();
          tag = this.strings.get(r);
        }

        if (currentNode)
          yield currentNode;
        currentNode = new WBXMLElement( (tok & 0x40) ? "STAG" : "TAG", tag,
                                        this._codepages);
        if (tok & 0x40)
          depth++;

        if (tok & 0x80) {
          state = States.ATTRIBUTES;
        }
        else {
          state = States.BODY;

          yield currentNode;
          currentNode = null;
        }
      }
      else { // if (state == States.ATTRIBUTES || state == States.ATTRIBUTE_PI)
        let attr = (codepage << 8) + tok;
        if (!(tok & 0x80)) {
          if (tok == Tokens.LITERAL) {
            let r = this._get_mb_uint32();
            attr = this.strings.get(r);
          }
          if (state == States.ATTRIBUTE_PI) {
            if (currentAttr)
              throw new WBXMLParseError("unexpected attribute in PI");
            currentAttr = currentNode._setTarget(attr);
          }
          else {
            currentAttr = currentNode._addAttribute(attr);
          }
        }
        else {
          currentAttr.push(attr);
        }
      }
    }
  },

  dump: function(indentation, header) {
    let result = "";

    if (indentation == undefined)
      indentation = 2;
    let indent = function(level) new Array(level*indentation + 1).join(" ");
    let tagstack = [];

    if (header) {
      result += "Version: " + this.version + "\n";
      result += "Public ID: " + this.pid + "\n";
      result += "Charset: " + this.charset + "\n";
      result += "String table:\n  \"" + this.strings.strings.join("\"\n  \"") +
                "\"\n\n";
    }

    let newline = false;
    for (let node in this.document) {
      if (node.type == "TAG" || node.type == "STAG") {
        result += indent(tagstack.length) + "<" + node.tagName;

        for (let [k,v] in node.attributes) {
          result += " " + k + "=\"" + v + "\"";
        }

        if (node.type == "STAG") {
          tagstack.push(node.tagName);
          result += ">\n";
        }
        else
          result += "/>\n";
      }
      else if (node.type == "ETAG") {
        let tag = tagstack.pop();
        result += indent(tagstack.length) + "</" + tag + ">\n";
      }
      else if (node.type == "TEXT") {
        result += indent(tagstack.length) + node.textContent + "\n";
      }
      else if (node.type == "PI") {
        result += indent(tagstack.length) + "<?" + node.target;
        if (node.data)
          result += " " + node.data;
        result += "?>\n";
      }
      else {
        throw new Error("Unknown node type \"" + node.type + "\"");
      }
    }

    return result;
  },
};

function WBXMLWriter(version, pid, charset, strings) {
  this._rawbuf = new ArrayBuffer(1024);
  this._buffer = new Uint8Array(this._rawbuf);
  this._pos = 0;
  this._codepage = 0;

  let [major, minor] = [parseInt(i) for (i of version.split("."))];
  let v = ((major - 1) << 4) + minor;

  this._write(v);
  this._write(pid);
  this._write(charset);
  if (strings) {
    let len = strings.reduce(function(x, y) x + y.length + 1, 0);
    this._write_mb_uint32(len);
    for (let [,s] in Iterator(strings)) {
      for (let i = 0; i < s.length; i++)
        this._write(s.charCodeAt(i));
      this._write(0x00);
    }
  }
  else {
    this._write(0x00);
  }
}

WBXMLWriter.Attribute = function(name, value) {
  this.name = name;
  this.value = value;
};

WBXMLWriter.StringTableRef = function(index) {
  this.index = index;
};

WBXMLWriter.Entity = function(code) {
  this.code = code;
};

WBXMLWriter.Extension = function(subtype, index, data) {
  const validTypes = {
    "string":  { value:     WBXMLTokens.EXT_I_0,
                 validator: function(data) typeof data == "string" },
    "integer": { value:     WBXMLTokens.EXT_T_0,
                 validator: function(data) typeof data == "number" },
    "byte":    { value:     WBXMLTokens.EXT_0,
                 validator: function(data) data == null || data == undefined },
  };

  let info = validTypes[subtype];
  if (!info)
    throw new Error("Invalid WBXML Extension type");
  if (!info.validator(data))
    throw new Error("Data for WBXML Extension does not match type");
  if (index !== 0 && index !== 1 && index !== 2)
    throw new Error("Invalid WBXML Extension index");

  this.subtype = info.value;
  this.index = index;
  this.data = data;
};

WBXMLWriter.a = function(name, value) new WBXMLWriter.Attribute(name, value);
WBXMLWriter.str_t = function(index) new WBXMLWriter.StringTableRef(index);
WBXMLWriter.ent = function(code) new WBXMLWriter.Entity(code);
WBXMLWriter.ext = function(subtype, index, data) new WBXMLWriter.Extension(
  subtype, index, data);

WBXMLWriter.prototype = {
  _write: function(tok) {
    this._buffer[this._pos++] = tok;
  },

  _write_mb_uint32: function(value) {
    let bytes = [];
    bytes.push(value % 0x80);
    while (value >= 0x80) {
      value >>= 7;
      bytes.push(0x80 + (value % 0x80));
    }

    for (let i = bytes.length - 1; i >= 0; i--)
      this._write(bytes[i]);
  },

  _write_str: function(str) {
    for (let i = 0; i < str.length; i++)
      this._write(str.charCodeAt(i));
  },

  _setCodepage: function(codepage) {
    if (this._codepage != codepage) {
      this._write(WBXMLTokens.SWITCH_PAGE);
      this._write(codepage);
      this._codepage = codepage;
    }
  },

  _writeTag: function(tag, stag, attrs) {
    let flags = 0x00;
    if (stag)
      flags += 0x40;
    if (attrs.length)
      flags += 0x80;

    if (tag instanceof WBXMLWriter.StringTableRef) {
      this._write(WBXMLTokens.LITERAL + flags);
      this._write_mb_uint32(tag.index);
    }
    else {
      this._setCodepage(tag >> 8);
      this._write((tag & 0xff) + flags);
    }

    if (attrs.length) {
      for (let [,attr] in Iterator(attrs))
        this._writeAttr(attr);
      this._write(WBXMLTokens.END);
    }
  },

  _writeAttr: function(attr) {
    if (!(attr instanceof WBXMLWriter.Attribute))
      throw new Error("Expected an Attribute object");

    if (attr.name instanceof WBXMLWriter.StringTableRef) {
      this._write(WBXMLTokens.LITERAL);
      this._write(attr.name.index);
    }
    else {
      this._setCodepage(attr.name >> 8);
      this._write(attr.name & 0xff);
    }
    this._writeText(attr.value, true);
  },

  _writeText: function(value, inAttr) {
    if (Array.isArray(value)) {
      for (let [,piece] in Iterator(value))
        this._writeText(piece, inAttr);
    }
    else if (value instanceof WBXMLWriter.StringTableRef) {
      this._write(WBXMLTokens.STR_T);
      this._write_mb_uint32(value.index);
    }
    else if (value instanceof WBXMLWriter.Entity) {
      this._write(WBXMLTokens.ENTITY);
      this._write_mb_uint32(value.code);
    }
    else if (value instanceof WBXMLWriter.Extension) {
      this._write(value.subtype + value.index);
      if (value.subtype == WBXMLTokens.EXT_I_0) {
        this._write_str(value.data);
        this._write(0x00);
      }
      else if (value.subtype == WBXMLTokens.EXT_T_0) {
        this._write_mb_uint32(value.data);
      }
    }
    else if (typeof value == "number") {
      if (!inAttr)
        throw new Error("Can't use attribute value constants outside of attrs");
      this._write(value);
    }
    else if (value != null) {
      this._write(WBXMLTokens.STR_I);
      this._write_str(value);
      this._write(0x00);
    }
  },

  tag: function(tag) {
    let tail = arguments.length > 1 ? arguments[arguments.length - 1] : null;
    if (tail instanceof WBXMLWriter.Attribute) {
      let rest = Array.prototype.slice.call(arguments, 1);
      this._writeTag(tag, false, rest);
      return this;
    }
    else {
      let head = Array.prototype.slice.call(arguments, 0, -1);
      return this.stag.apply(this, head)
                   .text(tail)
                 .etag();
    }
  },

  stag: function(tag, ...rest) {
    this._writeTag(tag, true, rest);
    return this;
  },

  etag: function(tag) {
    this._write(WBXMLTokens.END);
    return this;
  },

  text: function(value) {
    this._writeText(value);
    return this;
  },

  pi: function(target, data) {
    this._write(WBXMLTokens.PI);
    this._writeAttr(WBXMLWriter.a(target, data));
    this._write(WBXMLTokens.END);
    return this;
  },

  ext: function(subtype, index, data) {
    return this.text(WBXMLWriter.ext(subtype, index, data));
  },

  opaque: function(data) {
    this._write(WBXMLTokens.OPAQUE);
    this._write_mb_uint32(data.length);
    if (typeof data == "string") {
      this._write_str(data);
    }
    else {
      for (let i = 0; i < data.length; i++)
        this._write(data[i]);
    }
    return this;
  },

  get buffer() {
    let buf = new ArrayBuffer(this._pos);
    let tmp = new Uint8Array(buf);
    for (let i = 0; i < this._pos; i++)
      tmp[i] = this._buffer[i];
    return buf;
  },

  get bytes() {
    return new Uint8Array(this._rawbuf, 0, this._pos);
  },
};
