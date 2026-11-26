import type { LocalData } from './storage';

export function localMovementIndex(data: LocalData) {
  return new Map(data.movements.map((movement) => [movement.id, movement]));
}

export function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
