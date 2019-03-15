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

  test('parse valid USERNAME (2)', () => {
    const type = 0x0006;
    const msg = msgToBuf([
      'e3 83 9e e3', // }
      '83 88 e3 83', // }
      'aa e3 83 83', // }  Username value (18 bytes) and padding (2 bytes)
      'e3 82 af e3', // }
      '82 b9'      , // }
    ]);
    expect(readAttribute(type, msg)).toEqual({
      value: 'マトリックス',
      length: 18,
    });
  });

  test('parse valid ERROR-CODE (1)', () => {
    const type = 0x0009;
    const msg = msgToBuf([
      '00 00 03 0a',
      '65 72 72 6f 72 20 6d 65 73 73 61 67 65',
    ]);
    expect(readAttribute(type, msg)).toEqual({
      errClass: 3,
      errNumber: 10,
      reason: 'error message',
    });
  });

  test('parse valid ERROR-CODE (3)', () => {
    const type = 0x0009;
    // we don't throw if the reserved bits are not 0s
    const msg = msgToBuf([
      '02 00 03 0a',
      '65 72 72 6f 72 20 6d 65 73 73 61 67 65',
    ]);
    expect(readAttribute(type, msg)).toEqual({
      errClass: 3,
      errNumber: 10,
      reason: 'error message',
    });
  });

  test('parse valid REALM (1)', () => {
    const type = 0x0014;
    const msg = msgToBuf([
      '65 78 61 6d', // }
      '70 6c 65 2e', // }  Realm value (11 bytes) and padding (1 byte)
      '6f 72 67',    // }
    ]);

    expect(readAttribute(type, msg)).toEqual({
      value: 'example.org',
      length: 11,
    });
  });

  test('parse valid NONCE (1)', () => {
    const type = 0x0015;
    const msg = msgToBuf([
      '66 2f 2f 34', // }
      '39 39 6b 39', // }
      '35 34 64 36', // }
      '4f 4c 33 34', // }  Nonce value
      '6f 4c 39 46', // }
      '53 54 76 79', // }
      '36 34 73 41', // }
    ]);

    expect(readAttribute(type, msg)).toEqual({
      value: 'f//499k954d6OL34oL9FSTvy64sA',
      length: 28,
    });
  });

  test('parse valid UNKNOWN-ATTRIBUTES (1)', () => {
    const type = 0x000A;
    const msg = msgToBuf([
      '00 01 ff ff',
      '00 03 01 AA',
    ]);

    expect(readAttribute(type, msg)).toEqual({
      attributes: [ 0x01, 0xffff, 0x0003, 0x01aa],
    });
  });

  test('parse valid SOFTWARE (1)', () => {
    const type = 0x8022;
    const msg = msgToBuf([
      '74 65 73 74', //  }
      '20 76 65 63', //  }  UTF-8 server name
      '74 6f 72 20', //  }
    ]);

    expect(readAttribute(type, msg)).toEqual({
      value: 'test vector ',
      length: 12,
    });
  });

  test('parse valid ALTERNATE-SERVER (1)', () => {
    const type = 0x8023;
    expect(readAttribute(type, Buffer.from('0002100100010002100300040005000600070008', 'hex'))).toEqual({
      family: CONSTANTS.transport.address.family.IPv6,
      port: 4097,
      address: [ 0x01, 0x02, 0x1003, 0x04, 0x05, 0x06, 0x07, 0x08 ],
    });
  });

  test('parse valid CHANNEL-NUMBER (1)', () => {
    const type = 0x000c;
    expect(readAttribute(type, Buffer.from('01020000', 'hex'))).toEqual({
      channelNumber: 258,
    });
  });

  test('parse valid CHANNEL-NUMBER (2)', () => {
    const type = 0x000c;
    // allow non 0 rffu bits
    expect(readAttribute(type, Buffer.from('00330001', 'hex'))).toEqual({
      channelNumber: 51,
    });
  });

  test('parse valid LIFETIME (1)', () => {
    const type = 0x000d;
    expect(readAttribute(type, Buffer.from('12345678', 'hex'))).toEqual({
      lifetime: 0x12345678,
    });
  });

  test('parse valid XOR-PEER-ADDRESS (1)', () => {
    const type = 0x0012;
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

  test('parse valid DATA (1)', () => {
    const type = 0x0013;
    const result = readAttribute(type, Buffer.from('12345678', 'hex'));
    expect(result.value.toString('hex')).toEqual('12345678');
  });

  test('parse valid XOR-RELAYED-ADDRESS (1)', () => {
    const type = 0x0016;
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

  test('parse valid EVEN-PORT (1)', () => {
    const type = 0x0018;
    expect(readAttribute(type, Buffer.from('00', 'hex'))).toEqual({
      R: false,
    });
  });

  test('parse valid EVEN-PORT (2)', () => {
    const type = 0x0018;
    expect(readAttribute(type, Buffer.from('80', 'hex'))).toEqual({
      R: true,
    });
  });

  test('parse valid EVEN-PORT (3)', () => {
    const type = 0x0018;
    expect(readAttribute(type, Buffer.from('01', 'hex'))).toEqual({
      R: false,
    });
  });

  test('parse valid REQUESTED-TRANSPORT (1)', () => {
    const type = 0x0019;
    expect(readAttribute(type, Buffer.from('22000000', 'hex'))).toEqual({
      protocol: 34,
    });
  });

  test('parse valid DONT-FRAGMENT (1)', () => {
    const type = 0x001A;
    expect(readAttribute(type, Buffer.from('', 'hex'))).toEqual({
    });
  });

  test('parse valid RESERVATION-TOKEN (1)', () => {
    const type = 0x0022;
    expect(readAttribute(type, Buffer.from('42', 'hex'))).toEqual({
      token: 66,
    });
  });

});