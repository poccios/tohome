import { createHash, randomBytes } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRandomToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function generateOTP(length: number = 6): string {
  // Generate a random number with the specified length
  const max = Math.pow(10, length);
  const otp = Math.floor(Math.random() * max);

  // Pad with zeros to ensure the specified length
  return otp.toString().padStart(length, '0');
}
