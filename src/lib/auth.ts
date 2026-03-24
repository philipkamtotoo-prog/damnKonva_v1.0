import * as jose from 'jose'
import bcrypt from 'bcryptjs'

const SECRET_KEY = process.env.JWT_SECRET || 'changeme-in-production'
const encodedSecret = new TextEncoder().encode(SECRET_KEY)

export interface UserJwtPayload extends jose.JWTPayload {
  userId: string;
  username: string;
  isApiAdmin: boolean;
}

export async function signToken(payload: Omit<UserJwtPayload, 'exp' | 'iat'>) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedSecret)
}

export async function verifyToken(token: string): Promise<UserJwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, encodedSecret)
    return payload as UserJwtPayload
  } catch (error) {
    return null
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
