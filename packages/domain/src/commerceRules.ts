import type { Category } from './planning.ts';

export type CommerceRuleDraft = {
  pattern: string;
  match: 'phrase' | 'exact';
  categoryId: string;
};
export type CommerceRule = CommerceRuleDraft & { id: string };

function normalize(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/n\u0303/g, 'ñ')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const ruleKey = (rule: CommerceRuleDraft) => rule.match + ':' + normalize(rule.pattern);

function checkRule(rule: CommerceRuleDraft): CommerceRuleDraft {
  const pattern = typeof rule.pattern === 'string' ? rule.pattern.trim() : '';
  if (!pattern || pattern.length > 100 || !normalize(pattern))
    throw new Error('Escribe un comercio o una frase de hasta 100 caracteres.');
  if (rule.match !== 'phrase' && rule.match !== 'exact')
    throw new Error('Selecciona el tipo de coincidencia.');
  if (typeof rule.categoryId !== 'string' || !rule.categoryId.trim())
    throw new Error('Selecciona una categoría.');
  return { pattern, match: rule.match, categoryId: rule.categoryId };
}

export function setCommerceRule(rules: readonly CommerceRule[], input: CommerceRule) {
  const rule = { ...checkRule(input), id: input.id };
  if (rules.some((existing) => existing.id !== rule.id && ruleKey(existing) === ruleKey(rule)))
    throw new Error('Ya existe una regla con esa descripción y tipo de coincidencia.');
  return [...rules.filter((existing) => existing.id !== rule.id), rule];
}

export function validCommerceRules(value: unknown): value is CommerceRule[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const keys = new Set<string>();
  try {
    for (const rule of value as CommerceRule[]) {
      checkRule(rule);
      const key = ruleKey(rule);
      if (typeof rule.id !== 'string' || !rule.id || ids.has(rule.id) || keys.has(key))
        return false;
      ids.add(rule.id);
      keys.add(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function suggestCommerceCategory(
  description: string,
  rules: readonly CommerceRule[],
  categories: readonly Category[],
) {
  const text = normalize(description);
  if (!text) return null;
  let best: { rule: CommerceRule; category: Category } | null = null;
  let bestScore = 0;
  let ambiguous = false;
  for (const rule of rules) {
    const phrase = normalize(rule.pattern);
    const exact = rule.match === 'exact';
    if (!phrase || (exact ? text !== phrase : !` ${text} `.includes(` ${phrase} `))) continue;
    const category = categories.find(
      (item) => item.id === rule.categoryId && !item.archived && !item.system,
    );
    if (!category) continue;
    const score = exact ? Infinity : phrase.length;
    if (score > bestScore) {
      best = { rule, category };
      bestScore = score;
      ambiguous = false;
    } else if (score === bestScore && best?.category.id !== category.id) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}
