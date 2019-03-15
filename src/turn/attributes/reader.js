import CONSTANTS from '../constants';

import { findTypeNameFromType } from './typeDefinitions';
import constants from '../constants';

// https://tools.ietf.org/html/rfc5389#section-15.1
// The address family can take on the following values
const IPv4 = 0x01;
const IPv6 = 0x02;

function parseTransportAddressFamily(valueFamily) {
  switch(valueFamily) {
  case IPv4:
    return CONSTANTS.transport.address.family.IPv4;
  case IPv6:
    return CONSTANTS.transport.address.family.IPv6;
  default:
    throw new Error('invalid address family');
  }
}

function addressValueLength(valueFamily) {
  switch(valueFamily) {
  case IPv4:
    return 4;
  case IPv6:
    return 16;
  default:
    throw new Error('invalid address family');
  }
}

function readRawAddress(valueFamily, data) {
  const buf = [];
  const length = addressValueLength(valueFamily);
  for(let i = 0; i < length ; i++) {
    buf.push(data.readUInt(1));
  }
  return buf;
}

function readAddress(valueFamily, data) {
  const address = [];
  switch(valueFamily) {
  case IPv4:
    for(let i = 0; i < 4 ; i++) {
      address.push(data.readUInt(1));
    }
    break;
  case IPv6:
    for(let i = 0; i < 8 ; i++) {
      address.push(data.readUInt(2));
    }
    break;
  default:
    throw new Error('invalid address family');
  }
  return address;
}

function buildIpv6Address(buf) {
  const result = [];
  for(let i = 0; i < 8; i++) {
    result.push(buf[i * 2] * 256 + buf[(i * 2) + 1]);
  }
  return result;
}

//  0                   1                   2                   3
//  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// |0 0 0 0 0 0 0 0|    Family     |           Port                |
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// |                                                               |
// |                 Address (32 bits or 128 bits)                 |
// |                                                               |
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
function readIPAddress(data) {
  const firstByte = data.readUInt(1);
  if (firstByte !== 0) {
    throw new Error('The first 8 bits of the MAPPED-ADDRESS must be set to 0');
  }
  const valueFamily = data.readUInt(1);
  const port = data.readUInt(2);
  const address = readAddress(valueFamily, data);
  return {
    family: parseTransportAddressFamily(valueFamily),
    port,
    address,
  };

}

//  0                   1                   2                   3
//  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// |x x x x x x x x|    Family     |         X-Port                |
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// |                X-Address (Variable)
// +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
function readXorIPAddress(data, transactionId) {
  if (!transactionId || transactionId.length !== 12) {
    throw new Error('missing transactionId');
  }
  const firstByte = data.readUInt(1);
  if (firstByte !== 0) {
    throw new Error('The first 8 bits of the MAPPED-ADDRESS must be set to 0');
  }
  const valueFamily = data.readUInt(1);
  const xPort = data.readUInt(2);
  const port = xPort ^ (constants.magicCookie >> 16);
  const xAddress = readRawAddress(valueFamily, data);
  const magicCookieBuffer = [];
  for(let i = 0; i < 4 ; i++) {
    magicCookieBuffer.push(CONSTANTS.magicCookieBytes[i]);
  }
  for(let i = 0; i < 12 ; i++) {
    magicCookieBuffer.push(transactionId[i]);
  }
  var address = [];
  for(let i = 0; i < xAddress.length ; i++) {
    address.push((xAddress[i] & 0xff) ^ magicCookieBuffer[i]);
  }

  return {
    family: parseTransportAddressFamily(valueFamily),
    port,
    address: (valueFamily === IPv6) ? buildIpv6Address(address) : address,
  };
}

const bufReader = (buf) => {
  let offset = 0;
  const length = buf.length;
  return {
    readUInt(byteLength) {
      if (offset + byteLength > length) {
        throw new Error(`Overfow readUInt at offset:${offset} with length:${byteLength} maxLength is: ${length}`);
      }
      const value = buf.readUIntBE(offset, byteLength);
      offset += byteLength;
      return value;
    },
    readUTF8(byteLength) {
      if (offset + byteLength > length) {
        throw new Error(`Overfow readUTF8 at offset:${offset} with length:${byteLength} maxLength is: ${length}`);
      }
      const value = buf.toString('utf8', offset, offset + byteLength);
      offset += byteLength;
      return value;
    },
    readBuffer(byteLength) {
      const value = buf.slice(0, byteLength);
      offset += byteLength;
      // we make a copy of the buffer
      return Buffer.from(value);
    },
    checkEmpty() {
      if (offset !== length) {
        throw new Error('unread data in message');
      }
    },
  };
};

const attributeReaders = [
  {
    // https://tools.ietf.org/html/rfc5389#section-15.1
    name: 'MAPPED-ADDRESS',
    reader: (data) => {
      const result = readIPAddress(data);
      data.checkEmpty();
      return result;
    },
  }, {
    name: 'XOR-MAPPED-ADDRESS',
    reader: (data, _length, transactionId) => {
      const result = readXorIPAddress(data, transactionId);
      data.checkEmpty();
      return result;
    },
  }, {
    name: 'USERNAME',
    reader: (data, length) => {
      const value = data.readUTF8(length);
      data.checkEmpty();
      return {
        value,
        length,
      };
    },
  }, {
    //  0                   1                   2                   3
    //  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
    // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    // |           Reserved, should be 0         |Class|     Number    |
    // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    // |      Reason Phrase (variable)                                ..
    // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    name: 'ERROR-CODE',
    reader: (data, length) => {
      const header =  data.readUInt(4);
      const reason = data.readUTF8(length - 4);
      const errNumber = header & 0xFF;
      const errClass = (header & 0x700) >> 8;
      data.checkEmpty();

      return {
        errClass,
        errNumber,
        reason,
      };
    },
  }, {
    name: 'REALM',
    reader: (data, length) => {
      const value = data.readUTF8(length);
      data.checkEmpty();
      return {
        value,
        length,
      };
    },
  }, {
    name: 'NONCE',
    reader: (data, length) => {
      const value = data.readUTF8(length);
      data.checkEmpty();
      return {
        value,
        length,
      };
    },
  }, {
    name: 'UNKNOWN-ATTRIBUTES',
    reader: (data, length) => {
      if (length % 2 !== 0) {
        throw new Error('invalid message length for UNKNOWN-ATTRIBUTES');
      }
      const attributes = [];
      for(let i = 0; i < length / 2; i++) {
        attributes[i] = data.readUInt(2);
      }
      data.checkEmpty();
      return {
        attributes,
      };
    },
  }, {
    name: 'SOFTWARE',
    reader: (data, length) => {
      const value = data.readUTF8(length);
      data.checkEmpty();
      return {
        value,
        length,
      };
    },
  }, {
    name: 'ALTERNATE-SERVER',
    reader: (data) => {
      const result = readIPAddress(data);
      data.checkEmpty();
      return result;
    },
  }, {
    name: 'CHANNEL-NUMBER',
    reader: (data, length) => {
      if (length !== 4) {
        throw new Error('Invalid length for CHANNEL-NUMBER');
      }
      const channelNumber = data.readUInt(2);
      const _rffu = data.readUInt(2);
      data.checkEmpty();
      return {
        channelNumber,
      };
    },
  }, {
    name: 'LIFETIME',
    reader: (data) => {
      const value = data.readUInt(4);
      data.checkEmpty();
      return {
        lifetime: value,
      };
    },
  }, {
    name: 'XOR-PEER-ADDRESS',
    reader: (data, _length, transactionId) => {
      const result = readXorIPAddress(data, transactionId);
      data.checkEmpty();
      return result;
    },
  }, {
    name: 'DATA',
    reader: (data, length) => {
      const value = data.readBuffer(length);
      data.checkEmpty();
      return {
        value,
      };
    },
  }, {
    name: 'XOR-RELAYED-ADDRESS',
    reader: (data, _length, transactionId) => {
      const result = readXorIPAddress(data, transactionId);
      data.checkEmpty();
      return result;
    },
  }, {
    name: 'EVEN-PORT',
    reader: (data) => {
      //  0
      //  0 1 2 3 4 5 6 7
      // +-+-+-+-+-+-+-+-+
      // |R|    RFFU     |
      // +-+-+-+-+-+-+-+-+
      const value = data.readUInt(1);
      data.checkEmpty();
      return {
        R: (value & 0x80) !== 0,
      };
    },
  }, {
    name: 'REQUESTED-TRANSPORT',
    reader: (data) => {
      //  0                   1                   2                   3
      //  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      // |    Protocol   |                    RFFU                       |
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      const value = data.readUInt(1);
      const _rffu = data.readUInt(3);
      data.checkEmpty();
      return {
        protocol: value,
      };
    },
  },{
    name: 'DONT-FRAGMENT',
    reader: (_data, length) => {
      // TODO add generic mechanism to ensure all data have been read
      if (length !== 0) {
        throw new Error('Invalid message');
      }
      return {
        // empty message
      };
    },
  }, {
    name: 'RESERVATION-TOKEN',
    reader: (data) => {
      const value = data.readUInt(1);
      data.checkEmpty();
      return {
        token: value,
      };
    },
  },
];

// transactionId is optional. If present it's a 12 bytes array (96 bits)
export default function readAttribute(type, bufValue, transactionId = []) {
  const typeName = findTypeNameFromType(type);
  const def = attributeReaders.find(a => a.name === typeName);
  if (!def) {
    console.log(typeName);
    throw new Error('invalid type');
  }
  const data = bufReader(bufValue);
  const length = bufValue.length;

  return def.reader(data, length, transactionId);
}