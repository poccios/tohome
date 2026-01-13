import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

export interface AccessTokenPayload {
  userId: string;
  phone: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(
    {
      ...payload,
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
    },
    JWT_SECRET,
    {
      expiresIn: '15m',
    }
  );
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(
    {
      ...payload,
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
    },
    JWT_SECRET,
    {
      expiresIn: '30d',
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}
