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
  };
};

const attributeReaders = [
  {
    // https://tools.ietf.org/html/rfc5389#section-15.1
    name: 'MAPPED-ADDRESS',
    reader: (data) => {
      //  0                   1                   2                   3
      //  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      // |0 0 0 0 0 0 0 0|    Family     |           Port                |
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      // |                                                               |
      // |                 Address (32 bits or 128 bits)                 |
      // |                                                               |
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
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
    },
  }, {
    name: 'XOR-MAPPED-ADDRESS',
    reader: (data, _length, transactionId) => {
      //  0                   1                   2                   3
      //  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      // |x x x x x x x x|    Family     |         X-Port                |
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
      // |                X-Address (Variable)
      // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
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
    },
  }, {
    name: 'USERNAME',
    reader: (data, length) => {
      return {
        value: data.readUTF8(length),
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
      const reserved = (header & 0xFFFFF800) >> 8;
      if (reserved !== 0) {
        throw new Error('The Reserved bits SHOULD be 0');
      }
      const errNumber = header & 0xFF;
      const errClass = (header & 0x700) >> 8;

      return {
        errClass,
        errNumber,
        reason,
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