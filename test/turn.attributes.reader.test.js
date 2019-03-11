import CONSTANTS from '../src/turn/constants';
import readAttribute from '../src/turn/attributes/reader';

describe('turn.attributes.reader.test', () => {
  test('parse valid MAPPED-ADDRESS', () => {
    const type = 0x0001;
    expect(readAttribute(type, Buffer.from('0001000A01020304', 'hex'))).toEqual({
      family: CONSTANTS.transport.address.family.IPv4,
      port: 10,
      address: parseInt('01020304', 16),
    });
  });
});