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

export default router;
