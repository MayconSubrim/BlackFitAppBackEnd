import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { forbidden, handleError } from '../utils/errors.js';
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

export default router;
