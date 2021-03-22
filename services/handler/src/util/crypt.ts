import { Config, kConfig } from '@ama/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { container } from 'tsyringe';

/**
 * Generates an init vector (16 bytes), uses it to encrypt the data and then prefixes it to the digest
 * @param data Data to encrypt
 */
export const encrypt = (data: string) => {
  const { encryptionKey } = container.resolve<Config>(kConfig);

  const key = Buffer.from(encryptionKey, 'base64');
  const iv = randomBytes(16);

  const cipher = createCipheriv('aes-256-ctr', key, iv);
  return Buffer
    .concat([iv, cipher.update(data, 'utf8'), cipher.final()])
    .toString('base64');
};

/**
 * Reads the first 16 bytes of the digest (the init vector) and uses it to decrypt the rest (the actual data)
 * @param data Data to decrypt
 */
export const decrypt = (data: string) => {
  const { encryptionKey } = container.resolve<Config>(kConfig);

  const buffer = Buffer.from(data, 'base64');

  const key = Buffer.from(encryptionKey, 'base64');
  const iv = buffer.slice(0, 16);

  const decipher = createDecipheriv('aes-256-ctr', key, iv);

  return Buffer
    .concat([decipher.update(buffer.slice(16, buffer.length)), decipher.final()])
    .toString('utf8');
};
