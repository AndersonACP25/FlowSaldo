import { db } from '@flowsaldo/database';
import type { Prisma } from '@prisma/client';
import { categoryKey, type Category } from '@flowsaldo/domain';
export class CategoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
// Share-lock serializes assignment against archive and rename.
export async function assignCategory(
  tx: Prisma.TransactionClient,
  data: { category: string; categoryId?: string | null },
  previous?: { categoryId: string | null; category: string } | null,
) {
  const [category] = data.categoryId
    ? await tx.$queryRaw<Category[]>`SELECT * FROM "Category" WHERE id=${data.categoryId} FOR SHARE`
    : await tx.$queryRaw<
        Category[]
      >`SELECT * FROM "Category" WHERE "normalizedName"=${categoryKey(data.category)} FOR SHARE`;
  if (!category) throw new CategoryError('Selecciona una categoría existente.');
  if (category.archived && previous?.categoryId !== category.id)
    throw new CategoryError('La categoría está archivada. Selecciona una activa.', 409);
  return {
    categoryId: category.id,
    category: previous?.categoryId === category.id ? previous.category : category.name,
  };
}

export async function updateCategory(id: string, patch: { name?: string; archived?: boolean }) {
  return db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<
      Category[]
    >`SELECT * FROM "Category" WHERE id=${id} FOR UPDATE`;
    if (!existing) throw new CategoryError('Categoría no encontrada.', 404);
    if (existing.system)
      throw new CategoryError('Sin categorizar es una categoría del sistema.', 409);
    return tx.category.update({
      where: { id: existing.id },
      data: { ...patch, ...(patch.name ? { normalizedName: categoryKey(patch.name) } : {}) },
    });
  });
}

export async function deleteCategory(id: string) {
  await db.$transaction(async (tx) => {
    const [category] = await tx.$queryRaw<
      Category[]
    >`SELECT * FROM "Category" WHERE id=${id} FOR UPDATE`;
    if (!category) throw new CategoryError('Categoría no encontrada.', 404);
    if (category.system)
      throw new CategoryError('Sin categorizar es una categoría del sistema.', 409);
    const removed = await tx.category.deleteMany({
      where: {
        id,
        movements: { none: {} },
        recurringTemplates: { none: {} },
        budgetLimits: { none: {} },
      },
    });
    if (!removed.count)
      throw new CategoryError(
        'La categoría tiene movimientos, plantillas o presupuestos. Puedes archivarla para conservar esos datos.',
        409,
      );
  });
}
