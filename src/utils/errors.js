export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function badRequest(message) {
  return new AppError(400, message);
}

export function unauthorized(message = 'Token invalido') {
  return new AppError(401, message);
}

export function forbidden(message = 'Acesso negado') {
  return new AppError(403, message);
}

export function notFound(message = 'Recurso nao encontrado') {
  return new AppError(404, message);
}

export function handleError(error, res) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error?.code === 'P2002') {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(', ') : '';

    if (target.includes('email')) {
      return res.status(409).json({ error: 'Ja existe um usuario cadastrado com este email' });
    }

    return res.status(409).json({ error: 'Registro duplicado' });
  }

  if (error?.code === 'P2003') {
    return res.status(400).json({ error: 'Referencia relacionada invalida' });
  }

  console.error(error);

  return res.status(500).json({ error: 'Erro interno do servidor' });
}
