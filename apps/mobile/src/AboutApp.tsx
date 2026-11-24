import React from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import { applicationId, nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { expo } from '../app.json';
import { styles as s } from './theme';

const repository = 'https://github.com/AndersonACP25/FlowSaldo';

export function AboutApp() {
  const installedApk = Platform.OS === 'android' && applicationId === expo.android.package;
  const version = (installedApk && nativeApplicationVersion) || expo.version;
  return (
    <View style={s.card}>
      <Text style={s.title}>FlowSaldo</Text>
      <Text style={s.muted}>
        Organiza tus ingresos, gastos y presupuestos personales en DOP y USD.
      </Text>
      <View style={s.divider} />
      <View style={s.between}>
        <Text style={s.label}>Versión</Text>
        <Text style={s.text}>{version}</Text>
      </View>
      {installedApk && !!nativeBuildVersion && (
        <View style={s.between}>
          <Text style={s.label}>Compilación Android</Text>
          <Text style={s.text}>{nativeBuildVersion}</Text>
        </View>
      )}
      <Text
        accessibilityRole="link"
        style={s.link}
        onPress={() => {
          void Linking.openURL(repository).catch(() => Alert.alert('No se pudo abrir GitHub.'));
        }}
      >
        Proyecto en GitHub
      </Text>
    </View>
  );
}
