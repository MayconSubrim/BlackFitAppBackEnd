import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { handleError } from '../utils/errors.js';

const router = Router();

function getTodayRange() {
  // define o inicio do dia atual
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  // define o inicio do proximo dia
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function calculateStreak(checkins) {
  // sem check-ins, sem sequencia
  if (!checkins.length) return 0;

  // extrair dias unicos no formato YYYY-MM-DD e ordenar do mais recente para o mais antigo
  const days = [...new Set(
    checkins.map((checkin) => checkin.createdAt.toISOString().slice(0, 10))
  )].sort().reverse();

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  // contar quantos dias consecutivos existem a partir de hoje ou ontem
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

router.post('/', auth, async (req, res) => {
  try {
    // obter intervalo do dia atual
    const { start, end } = getTodayRange();

    // verificar se o usuario ja fez check-in hoje
    const existingCheckin = await prisma.checkin.findFirst({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: start,
          lt: end
        }
      }
    });

    if (existingCheckin) {
      // retornar o check-in ja existente do dia
      return res.status(200).json({
        alreadyCheckedIn: true,
        checkin: existingCheckin
      });
    }

    // criar novo check-in para o usuario autenticado
    const checkin = await prisma.checkin.create({
      data: { userId: req.user.id }
    });

    // retornar o novo check-in criado
    return res.status(201).json({
      alreadyCheckedIn: false,
      checkin
    });
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    // obter o usuario autenticado e o inicio do dia atual
    const userId = req.user.id;
    const { start: today } = getTodayRange();

    // buscar sessoes finalizadas hoje para o usuario
    const sessionsToday = await prisma.workoutSession.findMany({
      where: {
        userId,
        completedAt: { gte: today }
      }
    });

    // somar as calorias das sessoes de hoje
    const caloriesToday = sessionsToday.reduce(
      (accumulator, session) => accumulator + session.actualCalories,
      0
    );

    // buscar todos os check-ins do usuario do mais recente para o mais antigo
    const checkins = await prisma.checkin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // calcular metricas do usuario
    const totalCheckins = checkins.length;
    const metaAtual = Math.max(5, Math.ceil(totalCheckins / 5) * 5);
    const streakDays = calculateStreak(checkins);

    // retornar o resumo das estatisticas
    return res.json({
      caloriesToday,
      checkins: totalCheckins,
      metaAtual,
      streakDays
    });
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/ranking', auth, async (req, res) => {
  try {
    // agrupar check-ins por usuario e ordenar pelos maiores totais
    const ranking = await prisma.checkin.groupBy({
      by: ['userId'],
      _count: {
        userId: true
      },
      orderBy: {
        _count: {
          userId: 'desc'
        }
      }
    });

    // extrair ids dos usuarios presentes no ranking
    const userIds = ranking.map((item) => item.userId);

    // buscar os usuarios e todos os check-ins relacionados em paralelo
    const [users, allCheckins] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              name: true,
              role: true
            }
          })
        : [],
      userIds.length
        ? prisma.checkin.findMany({
            where: { userId: { in: userIds } },
            orderBy: { createdAt: 'desc' }
          })
        : []
    ]);

    // indexar usuarios por id para facilitar o acesso
    const usersById = new Map(users.map((user) => [user.id, user]));

    // agrupar check-ins por usuario para calcular a sequencia
    const checkinsByUser = new Map();

    for (const checkin of allCheckins) {
      const userCheckins = checkinsByUser.get(checkin.userId) ?? [];
      userCheckins.push(checkin);
      checkinsByUser.set(checkin.userId, userCheckins);
    }

    // montar a resposta final do ranking com posicao, total e sequencia
    return res.json(
      ranking.map((item, index) => ({
        rank: index + 1,
        userId: item.userId,
        totalCheckins: item._count.userId,
        streakDays: calculateStreak(checkinsByUser.get(item.userId) ?? []),
        user: usersById.get(item.userId) ?? null
      }))
    );
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
