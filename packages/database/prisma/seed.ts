import { db } from '../src/index.ts';
import { demoMovements } from '@flowsaldo/domain';
try {
 for (const movement of demoMovements) await db.movement.upsert({ where: { id: movement.id }, create: movement, update: {} });
} finally { await db.$disconnect(); }
