export default {
  transport: {
    address: {
      family: {
        IPv4: 'transport.address.family.ipv4',
        IPv6: 'transport.address.family.ipv6',
      },
    },
  },
  // https://tools.ietf.org/html/rfc5389#section-6
  // The magic cookie field MUST contain the fixed value  in
  // network byte order
  magicCookie: 0x2112A442,
  magicCookieBytes: [0x21, 0x12, 0xA4, 0x42],
};