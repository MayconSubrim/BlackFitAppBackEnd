import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { badRequest, forbidden, handleError, notFound } from '../utils/errors.js';
import { serializeUser, serializeUsers } from '../utils/serializers.js';
import {
  normalizeEmail,
  normalizePassword,
  normalizeString
} from '../utils/validations.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    // somente recepcionista pode listar usuarios
    if (req.user.role !== ROLES.RECEPTIONIST) {
      throw forbidden();
    }

    // buscar alunos, instrutores e recepcionistas cadastrados
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return res.json(serializeUsers(users));
  } catch (error) {
    return handleError(error, res);
  }
});

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

router.patch('/:id', auth, async (req, res) => {
  try {
    // somente recepcionista pode editar usuarios
    if (req.user.role !== ROLES.RECEPTIONIST) {
      throw forbidden();
    }

    // validar usuario alvo
    const id = normalizeString(req.params?.id, 'id');

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw notFound('Usuario nao encontrado');
    }

    // validacao e normalizacao dos campos editaveis
    const name = normalizeString(req.body?.name, 'name', { maxLength: 120 });
    const email = normalizeEmail(req.body?.email);

    const data = {
      name,
      email
    };

    if (req.body?.password) {
      const password = normalizePassword(req.body.password);
      data.password = await bcrypt.hash(password, 10);
    }

    if (user.role === ROLES.STUDENT && req.body?.instructorId) {
      const instructorId = normalizeString(req.body.instructorId, 'instructorId');

      const instructor = await prisma.user.findUnique({
        where: { id: instructorId }
      });

      if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
        throw notFound('Instrutor nao encontrado');
      }

      data.instructorId = instructorId;
    }

    // atualizar usuario mantendo role original
    const updatedUser = await prisma.user.update({
      where: { id },
      data
    });

    return res.json(serializeUser(updatedUser));
  } catch (error) {
    return handleError(error, res);
  }
});

router.patch('/:id/instructor', auth, async (req, res) => {
  try {
    // somente recepcionista pode ajustar vinculo aluno-instrutor
    if (req.user.role !== ROLES.RECEPTIONIST) {
      throw forbidden();
    }

    // validacao e normalizacao dos ids recebidos
    const id = normalizeString(req.params?.id, 'id');
    const instructorId = normalizeString(req.body?.instructorId, 'instructorId');

    const [student, instructor] = await Promise.all([
      prisma.user.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: instructorId } })
    ]);

    if (!student || student.role !== ROLES.STUDENT) {
      throw notFound('Aluno nao encontrado');
    }

    if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
      throw notFound('Instrutor nao encontrado');
    }

    if (student.id === instructor.id) {
      throw badRequest('Aluno e instrutor devem ser usuarios diferentes');
    }

    // atualizar instrutor responsavel pelo aluno
    const updatedStudent = await prisma.user.update({
      where: { id },
      data: { instructorId }
    });

    return res.json(serializeUser(updatedStudent));
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
