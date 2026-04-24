import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { forbidden, handleError, notFound } from '../utils/errors.js';
import {
  normalizeExercises,
  normalizeOptionalText,
  normalizePositiveInt,
  normalizeString
} from '../utils/validations.js';

const router = Router();

router.post('/', auth, async (req, res) => {
  try {
    // somente instrutor pode criar treino
    if (req.user.role !== ROLES.INSTRUCTOR) {
      throw forbidden();
    }

    // validacao e normalizacao dos campos do treino
    const title = normalizeString(req.body?.title, 'title', { maxLength: 120 });
    const description = normalizeOptionalText(req.body?.description, 'description', 500);
    const estimatedCalories = normalizePositiveInt(
      req.body?.estimatedCalories,
      'estimatedCalories',
      { max: 5000 }
    );
    const estimatedDuration = normalizePositiveInt(
      req.body?.estimatedDuration,
      'estimatedDuration',
      { max: 1440 }
    );
    const difficulty = normalizeOptionalText(req.body?.difficulty, 'difficulty', 50);
    const dayOfWeek = normalizeOptionalText(req.body?.dayOfWeek, 'dayOfWeek', 50);
    const exercises = normalizeExercises(req.body?.exercises);

    // criar treino e exercicios vinculados
    const workout = await prisma.workout.create({
      data: {
        title,
        description,
        estimatedCalories,
        estimatedDuration,
        difficulty,
        dayOfWeek,
        instructorId: req.user.id,
        exercises: exercises.length
          ? {
              create: exercises
            }
          : undefined
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        }
      }
    });

    return res.status(201).json(workout);
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/assign', auth, async (req, res) => {
  try {
    // somente instrutor pode atribuir treino
    if (req.user.role !== ROLES.INSTRUCTOR) {
      throw forbidden();
    }

    // validacao e normalizacao dos ids recebidos
    const userId = normalizeString(req.body?.userId, 'userId');
    const workoutId = normalizeString(req.body?.workoutId, 'workoutId');

    // buscar aluno e treino em paralelo
    const [student, workout] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.workout.findUnique({ where: { id: workoutId } })
    ]);

    if (!student || student.role !== ROLES.STUDENT) {
      throw notFound('Aluno nao encontrado');
    }

    if (!workout) {
      throw notFound('Treino nao encontrado');
    }

    if (workout.instructorId !== req.user.id) {
      throw forbidden('Voce nao pode atribuir este treino');
    }

    if (student.instructorId && student.instructorId !== req.user.id) {
      throw forbidden('Aluno nao vinculado a este instrutor');
    }

    // evitar duplicidade de atribuicao
    const existingAssignment = await prisma.workoutAssignment.findUnique({
      where: {
        userId_workoutId: {
          userId,
          workoutId
        }
      }
    });

    if (existingAssignment) {
      return res.json(existingAssignment);
    }

    // criar atribuicao do treino ao aluno
    const assignment = await prisma.workoutAssignment.create({
      data: { userId, workoutId }
    });

    return res.status(201).json(assignment);
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/getWorkouts', auth, async (req, res) => {
  try {
    const where =
      req.user.role === ROLES.INSTRUCTOR
        ? { instructorId: req.user.id }
        : {
            assignments: {
              some: {
                userId: req.user.id
              }
            }
          };

    const workouts = await prisma.workout.findMany({
      where,
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(workouts);
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
