import { db } from '../src/index.ts';
import { categoryKey, demoMovements } from '@flowsaldo/domain';
try {
  for (const movement of demoMovements)
    await db.movement.upsert({
      where: { id: movement.id },
      create: {
        ...movement,
        categoryId: (
          await db.category.findUniqueOrThrow({
            where: { normalizedName: categoryKey(movement.category) },
          })
        ).id,
      },
      update: {},
    });
} finally {
  await db.$disconnect();
}
