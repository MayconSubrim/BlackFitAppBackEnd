import jwt from 'jsonwebtoken';
import { requireEnv } from '../utils/env.js';
import { handleError, unauthorized } from '../utils/errors.js';

export function auth(req, res, next) {
  // pega o header Authorization
  const authHeader = req.headers.authorization;

  // verifica se existe
  if (!authHeader) {
    return handleError(unauthorized('Token nao informado'), res);
  }

  // formato esperado: "Bearer TOKEN"
  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return handleError(unauthorized('Token mal formatado'), res);
  }

  const [scheme, token] = parts;

  // verifica se comeca com Bearer
  if (scheme !== 'Bearer') {
    return handleError(unauthorized('Token mal formatado'), res);
  }

  try {
    // valida o token
    const decoded = jwt.verify(token, requireEnv('JWT_SECRET'));

    // salva no request
    req.user = decoded;

    // segue para a rota
    return next();
  } catch (error) {
    return handleError(unauthorized('Token invalido ou expirado'), res);
  }
}
