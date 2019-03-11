// STUN attributes are defined in:
// https://tools.ietf.org/html/rfc5389#section-18.2
// TURN attributes are defined in:
// https://tools.ietf.org/html/rfc5766#section-14
//

const typeDefinitions = [
  // Comprehension-required range (0x0000-0x7FFF)
  {
    name: 'MAPPED_ADDRESS',
    type: 0x0001,
  }, {
    name: 'USERNAME',
    type: 0x0006,
  }, {
    name: 'MESSAGE_INTEGRITY',
    type: 0x0008,
  }, {
    name: 'ERROR_CODE',
    type: 0x0009,
  }, {
    name: 'UNKNOWN_ATTRIBUTES',
    type: 0x000A,
  }, {
    // TURN
    name: 'CHANNEL_NUMBER',
    type: 0x000C,
  }, {
    // TURN
    name: 'LIFETIME',
    type: 0x000D,
  }, {
    // TURN
    name: 'XOR_PEER_ADDRESS',
    type: 0x0012,
  }, {
    // TURN
    name: 'DATA',
    type: 0x0013,
  }, {
    name: 'REALM',
    type: 0x0014,
  }, {
    name: 'NONCE',
    type: 0x0015,
  }, {
    // TURN
    name: 'XOR_RELAYED_ADDRESS',
    type: 0x0016,
  }, {
    // TURN
    name: 'EVEN_PORT',
    type: 0x0018,
  }, {
    // TURN
    name: 'REQUESTED_TRANSPORT',
    type: 0x0019,
  }, {
    // TURN
    name: 'DONT_FRAGMENT',
    type: 0x001A,
  }, {
    name: 'XOR_MAPPED_ADDRESS',
    type: 0x0020,
  }, {
    // TURN
    name: 'RESERVATION_TOKEN',
    type: 0x0022,
  },
  // Comprehension-optional range (0x8000-0xFFFF)
  {
    name: 'SOFTWARE',
    type: 0x8022,
  },{
    name: 'ALTERNATE_SERVER',
    type: 0x8023,
  },{
    name: 'FINGERPRINT',
    type: 0x8028,
  },
];

// typeDefinitions.forEach((a) => {
//   console.log(`${a.name}: ${a.type.toString(16)}`);
// });

export function findTypeNameFromType(type) {
  const def = typeDefinitions.find(d => d.type === type);
  return def ? def.name : null;
}