export interface DerivedKeys {
  encryptionKey: CryptoKey;
  address: string;
  writeToken: string;
  verifyKey: string;
}

/**
 * Generates a URL-safe base64 token using 32 random bytes.
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Derives encryptionKey (AES-GCM 256-bit), address, writeToken, and verifyKey
 * from a token string using HKDF-SHA-256 with 32-byte zero salt.
 */
export async function deriveKeys(token: string): Promise<DerivedKeys> {
  const tokenBytes = new TextEncoder().encode(token);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    tokenBytes,
    'HKDF',
    false,
    ['deriveKey', 'deriveBits']
  );

  const salt = new Uint8Array(32); // fixed 32 zero bytes

  // Helper to derive 256 bits (32 bytes) as hex string
  const deriveHex = async (infoLabel: string): Promise<string> => {
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: new TextEncoder().encode(infoLabel),
      },
      baseKey,
      256
    );
    return Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('nid-encrypt'),
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // extractable: false
    ['encrypt', 'decrypt']
  );

  const address = await deriveHex('nid-address');

  const verifyKeyBytes = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('nid-verify'),
    },
    baseKey,
    256
  );
  const verifyKey = Array.from(new Uint8Array(verifyKeyBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Derive writeToken via HMAC-SHA256(key=verifyKeyBytes, data="nid-write-auth")
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    verifyKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const writeTokenBytes = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    new TextEncoder().encode('nid-write-auth')
  );
  const writeToken = Array.from(new Uint8Array(writeTokenBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    encryptionKey,
    address,
    writeToken,
    verifyKey,
  };
}

/**
 * Encrypts a plaintext string using AES-GCM 256-bit key with a random 12-byte IV.
 * Returns the base64-encoded string: [IV (12 bytes) | ciphertext].
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  const ciphertextBytes = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + ciphertextBytes.length);
  combined.set(iv, 0);
  combined.set(ciphertextBytes, iv.length);

  const binString = Array.from(combined, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

/**
 * Decrypts a base64-encoded blob containing [IV (12 bytes) | ciphertext]
 * using the provided AES-GCM key.
 */
export async function decrypt(blob: string, key: CryptoKey): Promise<string> {
  try {
    const binString = atob(blob);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i);
    }

    if (bytes.length < 12) {
      throw new Error('Blob too short');
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed: data may be tampered or key is incorrect');
  }
}
