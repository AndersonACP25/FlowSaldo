import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Category, CommerceRule, CommerceRuleDraft } from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

const matchLabels = { exact: 'Descripción exacta', phrase: 'Frase en la descripción' };
const newRule: CommerceRuleDraft = { pattern: '', match: 'phrase', categoryId: '' };

export function CommerceRulesScreen({
  rules,
  categories,
  saving,
  onSave,
  onRemove,
}: {
  rules: CommerceRule[];
  categories: Category[];
  saving: boolean;
  onSave: (draft: CommerceRuleDraft, id?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const [editor, setEditor] = useState<(CommerceRuleDraft & { id?: string }) | null>(null);
  const [removing, setRemoving] = useState<CommerceRule | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeCategories = categories.filter((category) => !category.archived && !category.system);

  async function run(work: () => Promise<void>, message: string) {
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la regla.');
    }
  }

  function edit(rule: CommerceRuleDraft) {
    setError('');
    setNotice('');
    setRemoving(null);
    setEditor(rule);
  }

  return (
    <>
      {!editor && (
        <Button
          label="Nueva regla por comercio"
          disabled={saving || !activeCategories.length}
          onPress={() => edit(newRule)}
        />
      )}
      {!activeCategories.length && (
        <Text style={s.muted}>Crea o reactiva una categoría para asociarla a una regla.</Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {editor && (
        <View style={s.card}>
          <Field
            label="Comercio o frase"
            value={editor.pattern}
            maxLength={100}
            editable={!saving}
            onChangeText={(pattern) => setEditor({ ...editor, pattern })}
          />
          <FilterRow label="Tipo de coincidencia">
            {(['phrase', 'exact'] as const).map((match) => (
              <Choice
                key={match}
                label={matchLabels[match]}
                selected={editor.match === match}
                disabled={saving}
                onPress={() => setEditor({ ...editor, match })}
              />
            ))}
          </FilterRow>
          <FilterRow label="Categoría sugerida">
            {activeCategories.map((category) => (
              <Choice
                key={category.id}
                label={`Asignar ${category.name}`}
                text={category.name}
                selected={editor.categoryId === category.id}
                disabled={saving}
                onPress={() => setEditor({ ...editor, categoryId: category.id })}
              />
            ))}
          </FilterRow>
          <View style={s.row}>
            <Button
              label="Guardar regla"
              disabled={
                saving ||
                !editor.pattern.trim() ||
                !activeCategories.some((c) => c.id === editor.categoryId)
              }
              onPress={() =>
                void run(async () => {
                  await onSave(editor, editor.id);
                  setEditor(null);
                }, 'Regla guardada.')
              }
            />
            <Choice
              label="Cancelar edición de regla"
              centered
              text="Cancelar"
              selected={false}
              disabled={saving}
              onPress={() => {
                setEditor(null);
                setError('');
              }}
            />
          </View>
        </View>
      )}
      {!editor && !rules.length && (
        <Text style={s.muted}>
          Agrega una regla para sugerir categorías al registrar movimientos.
        </Text>
      )}
      {!editor &&
        rules.map((rule) => {
          const category = categories.find((item) => item.id === rule.categoryId);
          const inactive = !category || category.archived || category.system;
          return (
            <View key={rule.id} style={s.card}>
              <View style={s.between}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={s.title}>{rule.pattern}</Text>
                  <Text style={s.muted}>
                    {matchLabels[rule.match]} · {category?.name ?? 'Categoría eliminada'}
                    {inactive ? ' · Inactiva' : ''}
                  </Text>
                </View>
                <View style={s.row}>
                  <IconButton
                    icon="edit"
                    label={`Editar regla para ${rule.pattern}`}
                    disabled={saving}
                    onPress={() => edit(rule)}
                  />
                  <IconButton
                    icon="trash"
                    label={`Eliminar regla para ${rule.pattern}`}
                    danger
                    disabled={saving}
                    onPress={() => {
                      setRemoving(rule);
                      setError('');
                      setNotice('');
                    }}
                  />
                </View>
              </View>
              {removing?.id === rule.id && (
                <View style={s.row}>
                  <Button
                    label="Confirmar eliminación de la regla"
                    disabled={saving}
                    onPress={() =>
                      void run(async () => {
                        await onRemove(rule.id);
                        setRemoving(null);
                      }, 'Regla eliminada.')
                    }
                  />
                  <Choice
                    label="Cancelar eliminación de la regla"
                    text="Cancelar"
                    selected={false}
                    disabled={saving}
                    onPress={() => setRemoving(null)}
                  />
                </View>
              )}
            </View>
          );
        })}
    </>
  );
}
