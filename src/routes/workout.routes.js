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
const WORKOUT_REPEAT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
        },
        sessions: {
          where: {
            userId: req.user.id
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(workouts);
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const id = normalizeString(req.params?.id, 'id');

    const where =
      req.user.role === ROLES.INSTRUCTOR
        ? {
            id,
            instructorId: req.user.id
          }
        : {
            id,
            assignments: {
              some: {
                userId: req.user.id
              }
            }
          };

    // buscar detalhe do treino permitido para o usuario logado
    const workout = await prisma.workout.findFirst({
      where,
      include: {
        exercises: {
          orderBy: { order: 'asc' }
        },
        sessions: {
          where: {
            userId: req.user.id
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!workout) {
      throw notFound('Treino nao encontrado');
    }

    return res.json(workout);
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/:id/sessions/start', auth, async (req, res) => {
  try {
    // somente aluno inicia execucao de treino
    if (req.user.role !== ROLES.STUDENT) {
      throw forbidden('Apenas alunos podem iniciar treinos');
    }

    const workoutId = normalizeString(req.params?.id, 'id');

    const workout = await prisma.workout.findFirst({
      where: {
        id: workoutId,
        assignments: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!workout) {
      throw notFound('Treino nao encontrado');
    }

    const lastCompletedSession = await prisma.workoutSession.findFirst({
      where: {
        userId: req.user.id,
        workoutId,
        completedAt: { not: null }
      },
      orderBy: { completedAt: 'desc' }
    });

    if (
      lastCompletedSession?.completedAt &&
      Date.now() - lastCompletedSession.completedAt.getTime() < WORKOUT_REPEAT_COOLDOWN_MS
    ) {
      throw forbidden('Este treino so pode ser feito novamente apos 24 horas');
    }

    const openSession = await prisma.workoutSession.findFirst({
      where: {
        userId: req.user.id,
        workoutId,
        completedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (openSession) {
      return res.json(openSession);
    }

    // criar sessao aberta para acompanhar inicio/finalizacao
    const session = await prisma.workoutSession.create({
      data: {
        userId: req.user.id,
        workoutId
      }
    });

    return res.status(201).json(session);
  } catch (error) {
    return handleError(error, res);
  }
});

router.patch('/sessions/:sessionId/finish', auth, async (req, res) => {
  try {
    // somente aluno finaliza a propria sessao
    if (req.user.role !== ROLES.STUDENT) {
      throw forbidden('Apenas alunos podem finalizar treinos');
    }

    const sessionId = normalizeString(req.params?.sessionId, 'sessionId');

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        workout: true
      }
    });

    if (!session || session.userId !== req.user.id) {
      throw notFound('Sessao de treino nao encontrada');
    }

    if (session.completedAt) {
      return res.json(session);
    }

    const actualDuration = req.body?.actualDuration
      ? normalizePositiveInt(req.body.actualDuration, 'actualDuration', { max: 1440 })
      : Math.max(1, Math.round((Date.now() - session.startedAt.getTime()) / 60000));

    const actualCalories = req.body?.actualCalories
      ? normalizePositiveInt(req.body.actualCalories, 'actualCalories', { max: 5000 })
      : session.workout.estimatedCalories;

    // finalizar sessao preenchendo metricas reais ou estimadas
    const completedSession = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        actualDuration,
        actualCalories,
        completedAt: new Date()
      }
    });

    return res.json(completedSession);
  } catch (error) {
    return handleError(error, res);
  }
});

router.delete('/:id/assignments/:userId', auth, async (req, res) => {
  try {
    // somente instrutor pode remover atribuicao de treino
    if (req.user.role !== ROLES.INSTRUCTOR) {
      throw forbidden();
    }

    // validar ids da rota
    const workoutId = normalizeString(req.params?.id, 'id');
    const userId = normalizeString(req.params?.userId, 'userId');

    const workout = await prisma.workout.findUnique({
      where: { id: workoutId }
    });

    if (!workout) {
      throw notFound('Treino nao encontrado');
    }

    if (workout.instructorId !== req.user.id) {
      throw forbidden('Voce nao pode alterar este treino');
    }

    const assignment = await prisma.workoutAssignment.findUnique({
      where: {
        userId_workoutId: {
          userId,
          workoutId
        }
      }
    });

    if (!assignment) {
      throw notFound('Atribuicao nao encontrada');
    }

    // remove apenas o vinculo entre aluno e treino, mantendo o treino criado
    await prisma.workoutAssignment.delete({
      where: {
        userId_workoutId: {
          userId,
          workoutId
        }
      }
    });

    return res.status(204).send();
  } catch (error) {
    return handleError(error, res);
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    // somente instrutor pode excluir treino criado por ele
    if (req.user.role !== ROLES.INSTRUCTOR) {
      throw forbidden();
    }

    const id = normalizeString(req.params?.id, 'id');

    const workout = await prisma.workout.findUnique({
      where: { id }
    });

    if (!workout) {
      throw notFound('Treino nao encontrado');
    }

    if (workout.instructorId !== req.user.id) {
      throw forbidden('Voce nao pode excluir este treino');
    }

    // remove o treino e deixa o Prisma apagar exercicios/atribuicoes em cascata
    await prisma.workout.delete({
      where: { id }
    });

    return res.status(204).send();
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
