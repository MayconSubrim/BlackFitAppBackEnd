import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { forbidden, handleError, notFound } from '../utils/errors.js';
import { serializeUser } from '../utils/serializers.js';
import {
  normalizeEmail,
  normalizePassword,
  normalizeString
} from '../utils/validations.js';

const router = Router();

router.post('/create-student', auth, async (req, res) => {
  try {
    // somente recepcionista pode criar aluno
    if (req.user.role !== ROLES.RECEPTIONIST) {
      throw forbidden();
    }

    // validacao e normalizacao dos campos
    const name = normalizeString(req.body?.name, 'name', { maxLength: 120 });
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);
    const instructorId = normalizeString(req.body?.instructorId, 'instructorId');

    // verificar se o instrutor existe
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId }
    });

    if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
      throw notFound('Instrutor nao encontrado');
    }

    // criptografar senha
    const hash = await bcrypt.hash(password, 10);

    // criar aluno vinculado ao instrutor
    const student = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role: ROLES.STUDENT,
        instructorId
      }
    });

    // remover senha antes de enviar resposta
    return res.status(201).json(serializeUser(student));
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/create-instructor', auth, async (req, res) => {
  try {
    // somente recepcionista pode criar instrutor
    if (req.user.role !== ROLES.RECEPTIONIST) {
      throw forbidden();
    }

    // validacao e normalizacao dos campos
    const name = normalizeString(req.body?.name, 'name', { maxLength: 120 });
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);

    // criptografar senha
    const hash = await bcrypt.hash(password, 10);

    // criar instrutor
    const instructor = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role: ROLES.INSTRUCTOR
      }
    });

    // remover senha antes de enviar resposta
    return res.status(201).json(serializeUser(instructor));
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
