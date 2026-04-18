import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { requireEnv } from '../utils/env.js';
import { badRequest, handleError } from '../utils/errors.js';
import { serializeUser } from '../utils/serializers.js';
import {
  normalizeEmail,
  normalizePassword,
  normalizeRole,
  normalizeString
} from '../utils/validations.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    // validacao e normalizacao dos campos
    const name = normalizeString(req.body?.name, 'name', {
      minLength: 2,
      maxLength: 120
    });
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);
    const role = normalizeRole(req.body?.role);

    // verificar se ja existe usuario com esse email
    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      throw badRequest('Email ja cadastrado');
    }

    // criptografar senha
    const hash = await bcrypt.hash(password, 10);

    // criar usuario
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role
      }
    });

    // remover senha antes de enviar resposta
    return res.status(201).json(serializeUser(user));
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/login', async (req, res) => {
  try {
    // validacao basica e normalizacao dos campos
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);

    // buscar usuario
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw badRequest('Usuario nao encontrado');
    }

    // comparar senha
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw badRequest('Senha invalida');
    }

    // gerar token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      requireEnv('JWT_SECRET'),
      { expiresIn: '7d' }
    );

    // remover senha da resposta
    // resposta
    return res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
