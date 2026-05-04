import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_RECEPTIONIST_NAME || 'Recepcao BlackFit';
  const email = (process.env.SEED_RECEPTIONIST_EMAIL || 'recepcao@blackfit.com')
    .trim()
    .toLowerCase();
  const password = process.env.SEED_RECEPTIONIST_PASSWORD || 'blackfit123';

  const existingReceptionist = await prisma.user.findUnique({
    where: { email }
  });

  if (existingReceptionist) {
    console.log(`Recepcionista seed ja existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: 'RECEPCIONISTA'
    }
  });

  console.log(`Recepcionista seed criado: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
