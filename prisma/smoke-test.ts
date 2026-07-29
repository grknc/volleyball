import { prisma } from '../src/lib/db';

async function main() {
  const player = await prisma.player.create({ data: { name: 'Test Oyuncu', level: 5 } });
  const found = await prisma.player.findUnique({ where: { id: player.id } });
  if (!found || found.name !== 'Test Oyuncu') {
    throw new Error('Smoke test failed: player not found or mismatched');
  }
  await prisma.player.delete({ where: { id: player.id } });
  console.log('OK: Prisma + PostgreSQL bağlantısı çalışıyor');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
