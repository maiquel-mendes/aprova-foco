import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyLocalBearerToken } from '../server/auth/localJwt.ts';
import { getPgDb, isPostgresDriver } from '../server/db/client.ts';
import { usersTable } from '../server/db/schema.ts';
import type { UserRole } from '../types.ts';

export interface AuthPrincipal {
  uid: string;
  email?: string;
  name?: string;
  role?: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthPrincipal;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (isPostgresDriver()) {
    const payload = verifyLocalBearerToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
    try {
      const db = getPgDb();
      const [userRow] = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
          role: usersTable.role,
        })
        .from(usersTable)
        .where(eq(usersTable.id, payload.uid))
        .limit(1);

      if (!userRow) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }

      req.user = {
        uid: userRow.id,
        email: userRow.email,
        name: userRow.displayName || undefined,
        role: (userRow.role as UserRole) || 'user',
      };
      return next();
    } catch (err) {
      console.error('Postgres auth lookup failed:', err);
      return res.status(500).json({ error: 'Erro ao validar sessão.' });
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }
    if (isPostgresDriver()) {
      const role = req.user.role || 'user';
      if (!allowedRoles.includes(role)) {
        return res
          .status(403)
          .json({ error: 'Permissão insuficiente para esta operação.' });
      }
    }
    next();
  };
};
