import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../database/DbClient'
import { Errors } from '../../shared/errors'
import { RegisterInput, LoginInput } from './auth.validation'
import { env } from '../../config/env'

const JWT_SECRET = env.JWT_SECRET
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN
const JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN
const JWT_REFRESH_REMEMBER = '30d'

export interface TokenPayload {
  sub: string
  email: string
  name: string
}

function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

function signRefreshToken(payload: TokenPayload, remember: boolean): string {
  const expiresIn = remember ? JWT_REFRESH_REMEMBER : JWT_REFRESH_EXPIRES_IN
  return jwt.sign(payload, JWT_SECRET + '-refresh', { expiresIn } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    throw Errors.unauthorized()
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET + '-refresh') as TokenPayload
  } catch {
    throw Errors.unauthorized()
  }
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw Errors.conflict('Ya existe una cuenta con ese email.')
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const payload: TokenPayload = { sub: user.id, email: user.email, name: user.name }
  return {
    user,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload, false),
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw Errors.unauthorized()

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw Errors.unauthorized()

  const { passwordHash: _, ...safeUser } = user
  const payload: TokenPayload = { sub: user.id, email: user.email, name: user.name }
  return {
    user: safeUser,
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload, input.remember ?? false),
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!user) throw Errors.notFound('Usuario')
  return user
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken)
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user) throw Errors.unauthorized()

  const newPayload: TokenPayload = { sub: user.id, email: user.email, name: user.name }
  return {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload, false),
  }
}
