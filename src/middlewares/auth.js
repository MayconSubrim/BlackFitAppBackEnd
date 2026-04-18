import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  // pega o header Authorization
  const authHeader = req.headers.authorization;

  // verifica se existe
  if (!authHeader) {
    return res.status(401).json({ error: 'Token não informado' });
  }

  // formato esperado: "Bearer TOKEN"
  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  const [scheme, token] = parts;

  // verifica se começa com Bearer
  if (scheme !== 'Bearer') {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  try {
    // valida o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // salva no request
    req.user = decoded;

    // segue para a rota
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}