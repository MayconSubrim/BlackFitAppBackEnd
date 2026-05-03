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

    // buscar instrutores com as notas recebidas
    const instructors = await prisma.user.findMany({
      where: { role: ROLES.INSTRUCTOR },
      select: {
        id: true,
        name: true,
        role: true,
        instructorRatings: {
          select: {
            studentId: true,
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
        const myRating = instructor.instructorRatings.find(
          (item) => item.studentId === req.user.id
        );
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
          averageRating,
          myRating: myRating?.rating ?? null
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

    // criar ou atualizar avaliacao do aluno para o instrutor
    const newRating = await prisma.rating.upsert({
      where: {
        studentId_instructorId: {
          studentId: req.user.id,
          instructorId
        }
      },
      create: {
        studentId: req.user.id,
        instructorId,
        rating,
        comment
      },
      update: {
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
