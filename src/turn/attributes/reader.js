import CONSTANTS from '../constants';

import { findTypeNameFromType } from './typeDefinitions';

// https://tools.ietf.org/html/rfc5389#section-15.1

// The address family can take on the following values
const IPv4 = 0x01;
const IPv6 = 0x02;

const bufReader = (buf) => {
  let offset = 0;
  return {
    readUInt(byteLength) {
      const value = buf.readUIntBE(offset, byteLength);
      offset += byteLength;
      return value;
    },
  };
};

const attributeReaders = [
  {
    // https://tools.ietf.org/html/rfc5389#section-15.1
    name: 'MAPPED_ADDRESS',
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
      let address = 0;
      let family = '';
      switch(valueFamily) {
      case IPv4:
        address = data.readUInt(4);
        family = CONSTANTS.transport.address.family.IPv4;
        break;
      case IPv6:
        address = data.readUInt(16);
        family = CONSTANTS.transport.address.family.IPv6;
        break;
      default:
        throw new Error('invalid address family');
      }
      return {
        family,
        port,
        address,
      };
    },
  },
];

export default function readAttribute(type, bufValue) {
  const typeName = findTypeNameFromType(type);
  const def = attributeReaders.find(a => a.name === typeName);
  if (!def) {
    throw new Error('invalid type');
  }
  const data = bufReader(bufValue);

  return def.reader(data);
}