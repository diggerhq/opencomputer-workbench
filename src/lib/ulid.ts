// A ULID for a submission: 10 characters of time, 16 of randomness, in
// Crockford base32. The composer mints one per logical submission and keeps
// it for that submission's retries only; the server pins it as the session's
// idempotency key and the `request` label.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(now: number = Date.now(), random: Uint8Array = randomBytes(10)): string {
  let time = now;
  const chars = new Array<string>(26);
  for (let i = 9; i >= 0; i -= 1) {
    chars[i] = ALPHABET[time % 32] as string;
    time = Math.floor(time / 32);
  }
  // 80 random bits as 16 base32 characters.
  let bits = 0;
  let value = 0;
  let position = 10;
  for (const byte of random) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && position < 26) {
      chars[position] = ALPHABET[(value >>> (bits - 5)) & 31] as string;
      position += 1;
      bits -= 5;
    }
  }
  return chars.join("");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
