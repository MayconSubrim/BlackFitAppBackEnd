import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { badRequest, forbidden, handleError, notFound } from '../utils/errors.js';
import {
  normalizeOptionalText,
  normalizePositiveInt,
  normalizeString
} from '../utils/validations.js';

const router = Router();

router.get('/instructors', auth, async (req, res) => {
  try {
    // somente alunos podem visualizar instrutores para avaliacao
    if (req.user.role !== ROLES.STUDENT) {
      throw forbidden('Apenas alunos podem visualizar instrutores para avaliacao');
    }

    // buscar o aluno logado para descobrir se ele possui instrutor vinculado
    const student = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // se o aluno tiver instrutor, listar apenas ele; senao listar todos os instrutores
    const where = student?.instructorId
      ? { id: student.instructorId, role: ROLES.INSTRUCTOR }
      : { role: ROLES.INSTRUCTOR };

    // buscar instrutores com as notas recebidas
    const instructors = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        role: true,
        instructorRatings: {
          select: {
            rating: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // montar resposta com total de avaliacoes e media por instrutor
    return res.json(
      instructors.map((instructor) => {
        const totalReviews = instructor.instructorRatings.length;
        const averageRating = totalReviews
          ? Number(
              (
                instructor.instructorRatings.reduce((sum, item) => sum + item.rating, 0) / totalReviews
              ).toFixed(1)
            )
          : 0;

        return {
          id: instructor.id,
          name: instructor.name,
          totalReviews,
          averageRating
        };
      })
    );
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/', auth, async (req, res) => {
  try {
    // somente alunos podem avaliar instrutores
    if (req.user.role !== ROLES.STUDENT) {
      throw forbidden('Apenas alunos podem avaliar instrutores');
    }

    // validacao e normalizacao dos campos recebidos
    const instructorId = normalizeString(req.body?.instructorId, 'instructorId');
    const rating = normalizePositiveInt(req.body?.rating, 'rating', { min: 1, max: 5 });
    const comment = normalizeOptionalText(req.body?.comment, 'comment', 500);

    // impedir autoavaliacao
    if (instructorId === req.user.id) {
      throw badRequest('Voce nao pode se autoavaliar');
    }

    // verificar se o instrutor existe e se possui o papel correto
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId }
    });

    if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
      throw notFound('Instrutor nao encontrado');
    }

    // buscar o aluno logado para validar o vinculo com o instrutor
    const student = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (student?.instructorId && student.instructorId !== instructorId) {
      throw forbidden('Voce so pode avaliar o seu instrutor');
    }

    // criar nova avaliacao
    const newRating = await prisma.rating.create({
      data: {
        studentId: req.user.id,
        instructorId,
        rating,
        comment
      }
    });

    return res.status(201).json(newRating);
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
