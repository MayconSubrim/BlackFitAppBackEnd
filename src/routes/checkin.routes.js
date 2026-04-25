import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middlewares/auth.js';
import { handleError } from '../utils/errors.js';

const router = Router();

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function calculateStreak(checkins) {
  if (!checkins.length) return 0;

  const days = [...new Set(
    checkins.map((checkin) => checkin.createdAt.toISOString().slice(0, 10))
  )].sort().reverse();

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

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
    const { start, end } = getTodayRange();

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
      return res.status(200).json({
        alreadyCheckedIn: true,
        checkin: existingCheckin
      });
    }

    const checkin = await prisma.checkin.create({
      data: { userId: req.user.id }
    });

    return res.status(201).json({
      alreadyCheckedIn: false,
      checkin
    });
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/ranking', auth, async (req, res) => {
  try {
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

    const userIds = ranking.map((item) => item.userId);

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

    const usersById = new Map(users.map((user) => [user.id, user]));
    const checkinsByUser = new Map();

    for (const checkin of allCheckins) {
      const userCheckins = checkinsByUser.get(checkin.userId) ?? [];
      userCheckins.push(checkin);
      checkinsByUser.set(checkin.userId, userCheckins);
    }

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
