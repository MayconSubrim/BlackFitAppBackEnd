import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { ROLES } from '../utils/constants.js';
import { forbidden, handleError } from '../utils/errors.js';

const router = Router();

function getWeekRange() {
  // calcula a semana atual considerando segunda-feira como inicio
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

function calculateStreak(checkins) {
  // sem check-ins, sem sequencia ativa
  if (!checkins.length) return 0;

  // agrupa os check-ins por dia para nao contar dois check-ins no mesmo dia
  const days = [...new Set(
    checkins.map((checkin) => checkin.createdAt.toISOString().slice(0, 10))
  )].sort().reverse();

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  // conta dias consecutivos partindo de hoje ou ontem
  for (const day of days) {
    const checkDate = new Date(`${day}T00:00:00`);
    const diff = Math.floor((current - checkDate) / (1000 * 60 * 60 * 24));

    if (diff === 0 || diff === 1) {
      streak += 1;
      current = checkDate;
    } else {
      break;
    }
  }

  return streak;
}

function formatWorkout(workout, userId) {
  const completed = workout.sessions.some((session) => session.completedAt);

  // entrega para o frontend somente os campos usados no card do dashboard
  return {
    id: workout.id,
    name: workout.title,
    exercises: workout.exercises.length,
    duration: `${workout.estimatedDuration} min`,
    difficulty: workout.difficulty || 'Nao informado',
    completed,
    dayOfWeek: workout.dayOfWeek || 'Sem dia definido',
    estimatedCalories: workout.estimatedCalories,
    estimatedDuration: workout.estimatedDuration,
    assignedAt: workout.assignments.find((assignment) => assignment.userId === userId)?.createdAt ?? null
  };
}

router.get('/', auth, async (req, res) => {
  try {
    // dashboard principal pertence ao fluxo do aluno
    if (req.user.role !== ROLES.STUDENT) {
      throw forbidden('Apenas alunos podem acessar o dashboard');
    }

    const userId = req.user.id;
    const { start: weekStart, end: weekEnd } = getWeekRange();

    // buscar treinos, sessoes e check-ins em paralelo para montar o painel
    const [workouts, completedSessions, checkins, weeklySessions] = await Promise.all([
      prisma.workout.findMany({
        where: {
          assignments: {
            some: { userId }
          }
        },
        include: {
          exercises: {
            orderBy: { order: 'asc' }
          },
          assignments: {
            where: { userId }
          },
          sessions: {
            where: { userId },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: { not: null }
        }
      }),
      prisma.checkin.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.workoutSession.findMany({
        where: {
          userId,
          completedAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      })
    ]);

    const caloriesBurned = completedSessions.reduce(
      (total, session) => total + session.actualCalories,
      0
    );
    const assignedWorkoutCount = workouts.length;
    const completedWorkoutIdsThisWeek = new Set(weeklySessions.map((session) => session.workoutId));
    const weeklyCompleted = completedWorkoutIdsThisWeek.size;
    const weeklyTotal = Math.max(assignedWorkoutCount, weeklyCompleted, 1);
    const weeklyPercentage = Math.round((weeklyCompleted / weeklyTotal) * 100);
    const goalsTarget = Math.max(10, Math.ceil(Math.max(checkins.length, 1) / 10) * 10);

    return res.json({
      stats: {
        caloriesBurned,
        assignedWorkoutCount,
        goalsCompleted: checkins.length,
        goalsTarget,
        streakDays: calculateStreak(checkins)
      },
      weeklyProgress: {
        completed: weeklyCompleted,
        total: weeklyTotal,
        percentage: weeklyPercentage
      },
      workouts: workouts.map((workout) => formatWorkout(workout, userId))
    });
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
