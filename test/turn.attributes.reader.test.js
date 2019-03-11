import CONSTANTS from '../src/turn/constants';
import readAttribute from '../src/turn/attributes/reader';

describe('turn.attributes.reader.test', () => {
  test('parse valid MAPPED-ADDRESS (1)', () => {
    const type = 0x0001;
    expect(readAttribute(type, Buffer.from('0001000A01020304', 'hex'))).toEqual({
      family: CONSTANTS.transport.address.family.IPv4,
      port: 10,
      address: parseInt('01020304', 16),
    });
  });
  test('parse invalid MAPPED-ADDRESS (1)', () => {
    const type = 0x0001;
    expect(() => readAttribute(type, Buffer.from('1001000A01020304', 'hex')))
      .toThrowError(/The first 8 bits of the MAPPED-ADDRESS must be set to 0/);
  });
  test('parse invalid MAPPED-ADDRESS (2)', () => {
    const type = 0x0001;
    expect(() => readAttribute(type, Buffer.from('0003000A01020304', 'hex')))
      .toThrowError(/invalid address family/);
  });
});