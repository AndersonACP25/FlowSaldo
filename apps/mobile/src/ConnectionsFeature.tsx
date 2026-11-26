import React from 'react';
import { Text, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import type { BankRegistration } from '@flowsaldo/domain';
import { BankConnections } from './BankDirectory';
import { IconButton } from './IconButton';
import { ImportQueue, type ImportStats } from './ImportQueue';
import { useTheme } from './theme';
import { Button, Field } from './ui';

export function ConnectionsFeature({
  connected,
  personal,
  busy,
  url,
  token,
  setToken,
  banks,
  bankDirectory,
  queue,
  sampleId,
  setSampleId,
  sampleBody,
  setSampleBody,
  resetConfirm,
  onBankSettings,
  onImportErrors,
  onConnect,
  onDisconnect,
  onLogout,
  onEnqueueSample,
  onReset,
  onCancelReset,
}: {
  connected: boolean;
  personal: boolean;
  busy: boolean;
  url: string;
  token: string;
  setToken: (token: string) => void;
  banks: BankRegistration[];
  bankDirectory: Pick<UseQueryResult, 'isPending' | 'isError'>;
  queue: UseQueryResult<ImportStats>;
  sampleId: string;
  setSampleId: (id: string) => void;
  sampleBody: string;
  setSampleBody: (body: string) => void;
  resetConfirm: boolean;
  onBankSettings: () => void;
  onImportErrors: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onLogout: () => Promise<void>;
  onEnqueueSample: () => void;
  onReset: () => void;
  onCancelReset: () => void;
}) {
  const { styles: s } = useTheme();
  return (
    <>
      <BankConnections
        banks={banks}
        loading={!!personal && bankDirectory.isPending}
        failed={bankDirectory.isError}
        onSettings={onBankSettings}
      />
      <Text style={s.title}>Centro de conexiones</Text>
      {connected && (
        <ImportQueue
          data={queue.data}
          loading={queue.isFetching}
          error={!!queue.error}
          onRefresh={() => void queue.refetch()}
          onErrors={onImportErrors}
        />
      )}
      <View style={s.card}>
        <Text style={s.title}>Correo</Text>
        <View style={s.between}>
          <Text style={s.text}>Gmail</Text>
          <Text style={s.muted}>
            {personal ? 'Gestionar en Configuración' : 'Requiere cuenta personal'}
          </Text>
        </View>
        <View style={s.between}>
          <Text style={s.text}>Outlook</Text>
          <Text style={s.muted}>Próximamente</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.title}>Conexión personal</Text>
        <Text style={s.text}>{url || 'Configura EXPO_PUBLIC_API_URL para conectar la API.'}</Text>
        {connected ? (
          personal ? (
            <IconButton
              icon="logout"
              label="Cerrar sesión y volver al acceso"
              onPress={() => void onLogout()}
            />
          ) : (
            <IconButton icon="logout" label="Desconectar y volver a demo" onPress={onDisconnect} />
          )
        ) : (
          <>
            <Field
              label="Token de desarrollo"
              value={token}
              onChangeText={setToken}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button label="Conectar API" disabled={!url || token.length < 24} onPress={onConnect} />
          </>
        )}
        <Text style={s.muted}>
          {personal
            ? 'Usa datos ficticios.'
            : 'El token de desarrollo funciona antes de crear la cuenta personal.'}
        </Text>
      </View>
      {connected && (
        <View style={s.card}>
          <Text style={s.title}>Laboratorio de correo sintético</Text>
          <Text style={s.muted}>
            Usa avisos ficticios. Los retiros admitidos de BHD y Popular aparecen en Por revisar.
          </Text>
          <Field
            label="Identificador del correo de prueba"
            value={sampleId}
            onChangeText={setSampleId}
            maxLength={200}
          />
          <Field
            label="Contenido sintético"
            value={sampleBody}
            onChangeText={setSampleBody}
            maxLength={10000}
            multiline
          />
          <Button
            label="Encolar correo de prueba"
            disabled={busy || !sampleId.trim() || !sampleBody.trim()}
            onPress={onEnqueueSample}
          />
        </View>
      )}
      <View style={s.card}>
        <Text style={s.title}>Datos de demostración</Text>
        <Text style={s.muted}>
          El restablecimiento borra los datos de demostración de este dispositivo.
        </Text>
        <Button
          label={resetConfirm ? 'Confirmar restablecimiento local' : 'Restablecer demo'}
          disabled={busy || connected}
          onPress={onReset}
        />
        {resetConfirm && <Button label="Cancelar restablecimiento" onPress={onCancelReset} />}
      </View>
    </>
  );
}
