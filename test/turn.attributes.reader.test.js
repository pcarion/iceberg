import CONSTANTS from '../src/turn/constants';
import readAttribute from '../src/turn/attributes/reader';

function msgToBuf(def) {
  return Buffer.from(def.join('').replace(/ /g, ''), 'hex');
}

function msgToBytes(def) {
  const result = [];
  const values = Buffer.from(def.join('').replace(/ /g, ''), 'hex').values();
  for (const value of values) {
    result.push(value);
  }
  return result;
}

describe('turn.attributes.reader.test', () => {
  test('parse valid MAPPED-ADDRESS (1)', () => {
    const type = 0x0001;
    expect(readAttribute(type, Buffer.from('0001000A01020304', 'hex'))).toEqual({
      family: CONSTANTS.transport.address.family.IPv4,
      port: 10,
      address: [ 0x01, 0x02, 0x03, 0x04 ],
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

  // from https://tools.ietf.org/html/rfc5769
  test('parse valid XOR-MAPPED-ADDRESS (1)', () => {
    const type = 0x0020;
    const transactionId = msgToBytes([
      'b7 e7 a7 01',
      'bc 34 d6 86',
      'fa 87 df ae',
    ]);
    const msg = msgToBuf([
      '00 02 a1 47', // Address family (IPv6) and xor'd mapped port number
      '01 13 a9 fa', // }
      'a5 d3 f1 79', //  }  Xor'd mapped IPv6 address
      'bc 25 f4 b5', //  }
      'be d2 b9 d9', //  }
    ]);
    expect(readAttribute(type, msg, transactionId)).toEqual({
      family: CONSTANTS.transport.address.family.IPv6,
      port: 32853,
      address: [
        parseInt('2001', 16),
        parseInt('db8', 16),
        parseInt('1234', 16),
        parseInt('5678', 16),
        parseInt('11', 16),
        parseInt('2233', 16),
        parseInt('4455', 16),
        parseInt('6677', 16),
      ],
    });
  });

  test('parse valid USERNAME (1)', () => {
    const type = 0x0006;
    expect(readAttribute(type, Buffer.from('68656c6c6f', 'hex'))).toEqual({
      value: 'hello',
      length: 5,
    });
  });

});