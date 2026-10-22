import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { demoMovements, summarize, type Movement, type Currency } from '@flowsaldo/domain';
const client = new QueryClient();
const money = (minor: number, currency: Currency) => `${currency} ${(minor / 100).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Home() {
 const [currency, setCurrency] = useState<Currency>('DOP');
 const [screen, setScreen] = useState<'Resumen' | 'Movimientos' | 'Conexión'>('Resumen');
 const [token, setToken] = useState('');
 const [connected, setConnected] = useState(false);
 const url = process.env.EXPO_PUBLIC_API_URL;
 const query = useQuery({ queryKey: ['movements', connected], enabled: connected, retry: false, queryFn: async (): Promise<Movement[]> => {
  const response = await fetch(`${url}/movements`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('No se pudo conectar. Revisa la dirección, el token y la API.');
  return response.json();
 } });
 const movements = connected ? (query.data ?? []) : demoMovements;
 const summary = summarize(movements, currency);
 return <SafeAreaView style={styles.root}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.content}>
  <Text style={styles.brand}>FlowSaldo <Text style={styles.accent}>↗</Text></Text>
  <Text style={styles.muted}>Tu dinero, con claridad.</Text>
  <View style={styles.banner}><Text style={styles.accent}>{connected ? 'API personal · últimos 200 movimientos' : 'MODO DEMO · datos ficticios'}</Text></View>
  <View style={styles.row}>{(['Resumen', 'Movimientos', 'Conexión'] as const).map(item => <Pressable accessibilityRole="button" key={item} onPress={() => setScreen(item)} style={[styles.tab, screen === item && styles.active]}><Text style={styles.text}>{item}</Text></Pressable>)}</View>
  {screen === 'Conexión' ? <View style={styles.card}>
   <Text style={styles.heading}>Conectar API de desarrollo</Text><Text style={styles.muted}>Los bancos y el correo todavía no están conectados. El token solo se mantiene en memoria.</Text>
   <Text style={styles.text}>{url ?? 'Configura EXPO_PUBLIC_API_URL en apps/mobile/.env'}</Text>
   <TextInput accessibilityLabel="Token de desarrollo" style={styles.input} placeholder="Token de desarrollo" placeholderTextColor="#a6b7bd" secureTextEntry value={token} onChangeText={setToken} autoCapitalize="none" />
   <Pressable style={styles.active} accessibilityRole="button" disabled={!url || !token} onPress={() => { setConnected(true); setScreen('Movimientos'); }}><Text style={styles.text}>Conectar</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={() => { setConnected(false); setToken(''); client.clear(); }}><Text style={styles.accent}>Volver a demo y borrar sesión</Text></Pressable>
  </View> : <>
   <View style={styles.row}>{(['DOP','USD'] as const).map(c => <Pressable accessibilityRole="button" key={c} onPress={() => setCurrency(c)} style={[styles.tab, c === currency && styles.active]}><Text style={styles.text}>{c}</Text></Pressable>)}</View>
   {query.isFetching && connected && <ActivityIndicator color="#65e5bd" />}
   {query.error && connected && <Text accessibilityRole="alert" style={styles.error}>{query.error.message}</Text>}
   {screen === 'Resumen' && <View style={styles.card}><Text style={styles.muted}>Diferencia de movimientos registrados</Text><Text style={styles.balance}>{money(summary.differenceMinor, currency)}</Text><Text style={styles.accent}>Ingresos: {money(summary.incomeMinor, currency)}</Text><Text style={styles.text}>Gastos: {money(summary.expenseMinor, currency)}</Text><Text style={styles.muted}>No equivale al saldo bancario. Transferencias propias excluidas. Totales del conjunto mostrado.</Text></View>}
   <Text style={styles.heading}>Movimientos</Text>
   {!movements.some(m => m.currency === currency) && <Text style={styles.muted}>No hay movimientos en esta moneda.</Text>}
   {movements.filter(m => m.currency === currency).map(m => <View key={m.id} style={styles.card}><Text style={styles.text}>{m.description}</Text><Text style={styles.muted}>{m.category} · {m.occurredAt.slice(0,10)}</Text><Text style={m.type === 'INCOME' ? styles.accent : styles.text}>{m.type === 'EXPENSE' ? '−' : m.type === 'INCOME' ? '+' : '↔'} {money(m.amountMinor, m.currency)}</Text></View>)}
  </>}
 </ScrollView></SafeAreaView>;
}
export default function App() { return <QueryClientProvider client={client}><Home /></QueryClientProvider>; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#091b22' }, content: { padding: 24, paddingTop: 48, gap: 18 }, brand: { color: '#fff', fontSize: 34, fontWeight: '800' }, heading: { color: '#fff', fontSize: 20, fontWeight: '700' }, accent: { color: '#65e5bd', fontSize: 15 }, muted: { color: '#a6b7bd', lineHeight: 22 }, text: { color: '#ecf5f5', fontSize: 15 }, banner: { backgroundColor: '#15352f', padding: 12, borderRadius: 12 }, row: { flexDirection: 'row', gap: 8 }, tab: { padding: 12, borderRadius: 10, backgroundColor: '#19313b' }, active: { padding: 12, borderRadius: 10, backgroundColor: '#26594d' }, card: { padding: 20, borderRadius: 18, backgroundColor: '#132c36', gap: 12 }, balance: { fontSize: 29, color: '#fff', fontWeight: '700' }, input: { color: '#fff', borderColor: '#50707a', borderWidth: 1, padding: 12, borderRadius: 8 }, error: { color: '#ffb5ae' } });
