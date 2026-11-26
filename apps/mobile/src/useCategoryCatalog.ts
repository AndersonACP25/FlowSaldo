import { useQuery } from '@tanstack/react-query';
import { categoryName, categoryKey, type Category } from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { ApiRequest } from './apiClient';
import type { LocalUpdate } from './storage';

export function useCategoryCatalog({
  dataScope,
  connected,
  localCategories,
  request,
  persist,
}: {
  dataScope: LocalScope;
  connected: boolean;
  localCategories: Category[];
  request: ApiRequest;
  persist: (change: LocalUpdate) => Promise<void>;
}) {
  const catalog = useQuery({
    queryKey: ['categories', dataScope],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<Category[]> => request('/categories'),
  });
  const categoryCatalog = connected ? (catalog.data ?? []) : localCategories;
  const catalogReady = !connected || catalog.isSuccess;
  async function saveCategory(name: string, id?: string) {
    name = categoryName(name);
    const normalizedName = categoryKey(name);
    if (connected) {
      await request(id ? `/categories/${id}` : '/categories', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({ name }),
      });
      await catalog.refetch();
    } else {
      await persist((current) => {
        const items = current.categories;
        const existing = items.find((c) => c.id === id);
        if (existing?.system) throw new Error('Sin categorizar es una categoría del sistema.');
        if (items.some((c) => c.normalizedName === normalizedName && c.id !== id))
          throw new Error('Ya existe una categoría con ese nombre.');
        const item: Category = {
          id: id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          normalizedName,
          archived: existing?.archived ?? false,
          system: false,
        };
        return {
          ...current,
          categories: id ? items.map((c) => (c.id === id ? item : c)) : [...items, item],
        };
      });
    }
  }
  async function archiveCategory(id: string, archived: boolean) {
    if (connected) {
      await request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
      await catalog.refetch();
    } else {
      await persist((current) => {
        if (current.categories.find((c) => c.id === id)?.system)
          throw new Error('Sin categorizar es una categoría del sistema.');
        return {
          ...current,
          categories: current.categories.map((c) => (c.id === id ? { ...c, archived } : c)),
        };
      });
    }
  }
  async function deleteCategory(id: string) {
    if (connected) {
      await request(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await catalog.refetch();
    } else {
      await persist((data) => {
        const category = data.categories.find((item) => item.id === id);
        if (!category) throw new Error('Categoría no encontrada.');
        if (category.system) throw new Error('Sin categorizar es una categoría del sistema.');
        const used =
          data.movements.some(
            (m) => m.categoryId === id || m.splits?.some((p) => p.categoryId === id),
          ) ||
          data.recurring.some((item) => item.categoryId === id) ||
          Object.keys(data.categoryBudgets).some((key) => key.split(':').slice(3).join(':') === id);
        if (used)
          throw new Error(
            'La categoría tiene movimientos, plantillas o presupuestos. Puedes archivarla para conservar esos datos.',
          );
        return { ...data, categories: data.categories.filter((item) => item.id !== id) };
      });
    }
  }

  return { catalog, categoryCatalog, catalogReady, saveCategory, archiveCategory, deleteCategory };
}
