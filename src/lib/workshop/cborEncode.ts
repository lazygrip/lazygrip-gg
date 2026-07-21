type CborEncodable =
  | null
  | boolean
  | number
  | string
  | CborEncodable[]
  | { [key: string]: CborEncodable };

export function encodeCbor(value: CborEncodable): Buffer {
  if (value === null) {
    return Buffer.from([0xf6]);
  }

  if (typeof value === "boolean") {
    return Buffer.from([value ? 0xf5 : 0xf4]);
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return encodeUnsignedInteger(value);
  }

  if (typeof value === "string") {
    const body = Buffer.from(value, "utf8");
    return Buffer.concat([encodeLength(3, body.length), body]);
  }

  if (Array.isArray(value)) {
    const chunks = value.map(encodeCbor);
    return Buffer.concat([encodeLength(4, value.length), ...chunks]);
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    const chunks = entries.flatMap(([key, child]) => [encodeCbor(String(key)), encodeCbor(child)]);
    return Buffer.concat([encodeLength(5, entries.length), ...chunks]);
  }

  throw new Error(`Unsupported CBOR value: ${typeof value}`);
}

function encodeUnsignedInteger(value: number): Buffer {
  if (value < 24) {
    return Buffer.from([value]);
  }
  if (value <= 0xff) {
    return Buffer.from([0x18, value]);
  }
  if (value <= 0xffff) {
    const buffer = Buffer.alloc(3);
    buffer[0] = 0x19;
    buffer.writeUInt16BE(value, 1);
    return buffer;
  }
  const buffer = Buffer.alloc(5);
  buffer[0] = 0x1a;
  buffer.writeUInt32BE(value, 1);
  return buffer;
}

function encodeLength(major: number, length: number): Buffer {
  if (length < 24) {
    return Buffer.from([(major << 5) | length]);
  }
  if (length <= 0xff) {
    return Buffer.from([(major << 5) | 24, length]);
  }
  if (length <= 0xffff) {
    const buffer = Buffer.alloc(3);
    buffer[0] = (major << 5) | 25;
    buffer.writeUInt16BE(length, 1);
    return buffer;
  }
  const buffer = Buffer.alloc(5);
  buffer[0] = (major << 5) | 26;
  buffer.writeUInt32BE(length, 1);
  return buffer;
}
