import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { BankRegistration } from '@flowsaldo/domain';
import { palette, styles as s } from './theme';
import { Choice, Field } from './ui';

const searchKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

export function BankSettings({
  banks,
  busy,
  local,
  onChange,
}: {
  banks: BankRegistration[];
  busy: boolean;
  local: boolean;
  onChange: (id: string, registered: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const registered = banks.filter((bank) => bank.registered);
  const filter = searchKey(search);
  const available = banks.filter(
    (bank) => !bank.registered && searchKey(bank.name).includes(filter),
  );

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>
        Mis bancos
      </Text>
      <Text style={s.muted}>
        Selecciona los bancos donde tienes productos.{' '}
        {local
          ? 'Tu selección se guarda en este dispositivo.'
          : 'Tu selección se guarda en tu cuenta personal.'}
      </Text>
      {registered.length ? (
        registered.map((bank) => (
          <View key={bank.id} style={s.between}>
            <Text style={s.text}>{bank.name}</Text>
            <Choice
              label={`Quitar ${bank.name}`}
              text="Quitar"
              selected={false}
              disabled={busy}
              onPress={() => onChange(bank.id, false)}
            />
          </View>
        ))
      ) : (
        <Text style={s.muted}>Todavía no tienes bancos registrados.</Text>
      )}
      <Choice
        label={editing ? 'Cerrar catálogo de bancos' : 'Agregar bancos'}
        selected={editing}
        onPress={() => setEditing((open) => !open)}
      />
      {editing && (
        <>
          <Field label="Buscar banco" value={search} onChangeText={setSearch} maxLength={80} />
          {available.map((bank) => (
            <View key={bank.id} style={s.between}>
              <Text style={s.text}>{bank.name}</Text>
              <Choice
                label={`Agregar ${bank.name}`}
                text="Agregar"
                selected={false}
                disabled={busy}
                onPress={() => onChange(bank.id, true)}
              />
            </View>
          ))}
          {!available.length && (
            <Text style={s.muted}>No hay bancos disponibles para esta búsqueda.</Text>
          )}
        </>
      )}
    </View>
  );
}

export function BankConnections({
  banks,
  loading,
  failed,
  onSettings,
}: {
  banks: BankRegistration[];
  loading: boolean;
  failed: boolean;
  onSettings: () => void;
}) {
  const registered = banks.filter((bank) => bank.registered);
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>
        Bancos dominicanos
      </Text>
      <Text style={s.muted}>
        Vista previa de conexiones directas con bancos de República Dominicana.
      </Text>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Cargando bancos" color={palette.primary} />
      ) : failed ? (
        <Text style={s.muted}>No se pudo mostrar la selección de bancos.</Text>
      ) : registered.length ? (
        registered.map((bank) => (
          <View key={bank.id} style={s.between}>
            <View>
              <Text style={s.text}>{bank.name}</Text>
              <Text style={s.muted}>Conexión pendiente</Text>
            </View>
            <Choice
              label={`Conectar ${bank.name}`}
              text="Conectar"
              selected={false}
              disabled
              onPress={() => {}}
            />
          </View>
        ))
      ) : (
        <Text style={s.muted}>Agrega tus bancos para verlos en esta sección.</Text>
      )}
      <Choice label="Administrar mis bancos" selected={false} onPress={onSettings} />
    </View>
  );
}
