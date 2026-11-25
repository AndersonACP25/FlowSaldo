import React from 'react';
import { Text, View } from 'react-native';
import {
  formatMinorAmount,
  maxMovementSplits,
  parseAmount,
  type Category,
} from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Choice, Field } from './ui';

export type SplitDraft = { categoryId: string; amount: string };

export function MovementSplitsEditor({
  active,
  amount,
  categories,
  previousIds,
  parts,
  onToggle,
  onChange,
}: {
  active: boolean;
  amount: string;
  categories: Category[];
  previousIds: string[];
  parts: SplitDraft[];
  onToggle: () => void;
  onChange: (parts: SplitDraft[]) => void;
}) {
  const { styles: s } = useTheme();
  function update(index: number, patch: Partial<SplitDraft>) {
    onChange(parts.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }
  const available = categories.filter(
    (category) => !category.archived || previousIds.includes(category.id),
  );
  let remaining: number | null = null;
  if (active) {
    try {
      remaining =
        parseAmount(amount) -
        parts.reduce((sum, part) => sum + (part.amount.trim() ? parseAmount(part.amount) : 0), 0);
    } catch {
      // Amounts may be incomplete while the user types.
    }
  }
  return (
    <>
      <Choice
        label={active ? 'Quitar división' : 'Dividir gasto'}
        selected={active}
        onPress={onToggle}
      />
      {active && (
        <>
          {parts.map((part, index) => (
            <View key={index} style={s.card}>
              <View style={s.between}>
                <Text style={s.label}>Parte {index + 1}</Text>
                {parts.length > 2 && (
                  <IconButton
                    icon="trash"
                    label={`Quitar parte ${index + 1}`}
                    onPress={() => onChange(parts.filter((_, i) => index !== i))}
                  />
                )}
              </View>
              <FilterRow label={`Categoría de la parte ${index + 1}`}>
                {available.map((category) => (
                  <Choice
                    key={category.id}
                    label={`Parte ${index + 1}: ${category.name}`}
                    text={category.name + (category.archived ? ' · Archivada' : '')}
                    selected={part.categoryId === category.id}
                    disabled={parts.some(
                      (other, i) => i !== index && other.categoryId === category.id,
                    )}
                    onPress={() => update(index, { categoryId: category.id })}
                  />
                ))}
              </FilterRow>
              <Field
                label={`Importe de la parte ${index + 1}`}
                value={part.amount}
                onChangeText={(value) => update(index, { amount: value })}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
          {remaining !== null && (
            <Text accessibilityLiveRegion="polite" style={remaining < 0 ? s.error : s.muted}>
              {remaining < 0
                ? `Exceso · ${formatMinorAmount(-remaining)}`
                : `Por distribuir · ${formatMinorAmount(remaining)}`}
            </Text>
          )}
          <Choice
            label="Añadir parte"
            selected={false}
            disabled={parts.length >= maxMovementSplits || parts.length >= available.length}
            onPress={() => onChange([...parts, { categoryId: '', amount: '' }])}
          />
        </>
      )}
    </>
  );
}
