import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { categoryExpenses, demoMovements, filterMovements, parseAmount, summarize, type Movement, type Currency, type MovementType } from '@flowsaldo/domain';
import { styles as s, palette } from './src/theme';
import { Button, Choice, Field } from './src/ui';
import { MovementForm, type Draft, typeLabels } from './src/MovementForm';
import { loadLocal, saveLocal, type LocalData } from './src/storage';
import { exportCsv } from './src/exportCsv';
const client=new QueryClient();
const money=(minor:number,currency:Currency)=>`${currency} ${(minor/100).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function currentMonth() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function shiftMonth(month:string,delta:number) { const [year,m]=month.split('-').map(Number); const d=new Date(year,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function initialData():LocalData { return {movements:demoMovements.map(m=>({...m,occurredAt:currentMonth()+m.occurredAt.slice(7)})),budgets:{}}; }
function Home() {
 const [local,setLocal]=useState<LocalData>(initialData); const localRef=useRef(local);
 const [ready,setReady]=useState(false); const [loadError,setLoadError]=useState('');
 const [currency,setCurrency]=useState<Currency>('DOP'); const [month,setMonth]=useState(currentMonth);
 const [screen,setScreen]=useState<'Resumen'|'Movimientos'|'Ajustes'>('Resumen');
 const [search,setSearch]=useState('');const [type,setType]=useState<MovementType|'ALL'>('ALL');
 const [editor,setEditor]=useState<Movement|'new'|null>(null);const [deleteId,setDeleteId]=useState<string|null>(null);
 const [token,setToken]=useState('');const [session,setSession]=useState('');
 const [notice,setNotice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [budgetInput,setBudgetInput]=useState('');const [resetConfirm,setResetConfirm]=useState(false);
 const url=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,''); const connected=!!session;
 useEffect(()=>{let active=true; void loadLocal().then(data=>{if(active){if(data){localRef.current=data;setLocal(data);}setReady(true);}}).catch(()=>{if(active)setLoadError('No se pudieron leer los datos locales. No se sobrescribieron. Puedes reintentar recargando o restablecer la demo.');});return()=>{active=false;};},[]);
 async function persist(next:LocalData) { await saveLocal(next);localRef.current=next;setLocal(next); }
 async function request(path:string,options:RequestInit={}) {
  const response=await fetch(`${url}${path}`,{...options,headers:{Authorization:`Bearer ${session}`,'Content-Type':'application/json'}});
  if(!response.ok) {const data=await response.json().catch(()=>null);throw new Error(data?.error??'No se pudo conectar con la API.');}
  return response.status===204?null:response.json();
 }
 const query=useQuery({queryKey:['movements',connected,month,currency],enabled:connected,retry:false,queryFn:async():Promise<Movement[]>=>request(`/movements?month=${month}&currency=${currency}`)});
 const source=connected?(query.data??[]):local.movements;
 const period=filterMovements(source,{currency,month});
 const visible=filterMovements(source,{currency,month,type,search});
 const summary=summarize(period,currency);const categories=categoryExpenses(period);
 const budgetKey=`${connected?'api':'demo'}:${month}:${currency}`;const budget=local.budgets[budgetKey]??0;
 const percentage=budget?Math.round(summary.expenseMinor/budget*100):0;
 async function action(work:()=>Promise<void>) {setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}}
 async function saveMovement(draft:Draft) {
  const edit=editor&&editor!=='new'?editor:null;
  if(connected){await request(edit?`/movements/${edit.id}`:'/movements',{method:edit?'PATCH':'POST',body:JSON.stringify(draft)});await client.invalidateQueries({queryKey:['movements']});}
  else {const item:Movement={...draft,id:edit?.id??`local-${Date.now()}-${Math.random().toString(36).slice(2)}`};await persist({...localRef.current,movements:edit?localRef.current.movements.map(m=>m.id===item.id?item:m):[item,...localRef.current.movements]});}
  setMonth(draft.occurredAt.slice(0,7));setCurrency(draft.currency);setSearch('');setType('ALL');setEditor(null);setScreen('Movimientos');setNotice('Movimiento guardado.');
 }
 async function remove(id:string) {
  if(connected){await request(`/movements/${id}`,{method:'DELETE'});await client.invalidateQueries({queryKey:['movements']});}
  else await persist({...localRef.current,movements:localRef.current.movements.filter(m=>m.id!==id)});
  setDeleteId(null);setNotice('Movimiento eliminado.');
 }
 async function reset() {const next=initialData();await persist(next);setLoadError('');setReady(true);setResetConfirm(false);setNotice('Demo restablecida.');}
 function disconnect(){setSession('');setToken('');client.clear();setEditor(null);setDeleteId(null);setNotice('Sesión cerrada. Volviste a la demo local.');}
 return <SafeAreaView style={s.root}><StatusBar style="dark"/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <View style={s.between}><View><Text style={s.eyebrow}>FINANZAS PERSONALES · V0.2</Text><Text style={s.brand}>FlowSaldo ↗</Text><Text style={s.muted}>Menos cuentas pendientes. Más claridad.</Text></View><Button label="+ Nuevo movimiento" disabled={!ready||busy||!!editor} onPress={()=>{setEditor('new');setScreen('Movimientos');setError('');setNotice('');}}/></View>
  <View style={s.banner}><Text style={s.text}>{connected?'API personal · máximo 200 movimientos del mes':'Demo local · datos ficticios guardados en este dispositivo'}</Text><Text style={s.muted}>El correo bancario todavía no está conectado.</Text></View>
  {!ready&&!loadError&&<ActivityIndicator color={palette.primary}/>}
  {!!loadError&&<View style={s.card}><Text style={s.error}>{loadError}</Text><Button label={resetConfirm?'Confirmar borrado local y restablecer':'Restablecer datos locales'} onPress={()=>resetConfirm?void action(reset):setResetConfirm(true)}/></View>}
  {ready&&<>
   <View style={s.row}>{(['Resumen','Movimientos','Ajustes'] as const).map(item=><Choice key={item} label={item} selected={screen===item} onPress={()=>{setScreen(item);setEditor(null);setDeleteId(null);}}/>)}</View>
   {!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
   {screen!=='Ajustes'&&<View style={s.between}><View style={s.row}><Choice label="‹ Mes anterior" selected={false} onPress={()=>setMonth(shiftMonth(month,-1))}/><Text style={s.title}>{month}</Text><Choice label="Mes siguiente ›" selected={false} onPress={()=>setMonth(shiftMonth(month,1))}/></View><View style={s.row}>{(['DOP','USD'] as const).map(c=><Choice key={c} label={c} selected={currency===c} onPress={()=>setCurrency(c)}/>)}</View></View>}
   {connected&&query.isFetching&&<ActivityIndicator color={palette.primary}/>}
   {connected&&query.error&&<View style={s.card}><Text accessibilityRole="alert" style={s.error}>{query.error.message}</Text><Button label="Reintentar" onPress={()=>void query.refetch()}/></View>}
   {screen==='Resumen'&&<>
    <View style={s.hero}><Text style={s.white}>Diferencia registrada · {month}</Text><Text style={s.heroValue}>{money(summary.differenceMinor,currency)}</Text><Text style={s.white}>Ingresos menos gastos. No equivale al saldo del banco.</Text></View>
    <View style={s.metrics}><View style={s.metric}><Text style={s.muted}>Ingresos</Text><Text style={s.income}>{money(summary.incomeMinor,currency)}</Text></View><View style={s.metric}><Text style={s.muted}>Gastos</Text><Text style={s.expense}>{money(summary.expenseMinor,currency)}</Text></View><View style={s.metric}><Text style={s.muted}>Movimientos</Text><Text style={s.amount}>{period.length}</Text></View></View>
    <View style={s.card}><Text style={s.title}>Tu presupuesto mensual</Text><Text style={s.muted}>Límite de gastos para {month} en {currency}. Guardado en este dispositivo para el modo actual.</Text>
     {budget>0&&<><Text style={percentage>=100?s.expense:s.amount}>{percentage}% utilizado · {money(budget,currency)}</Text><View accessibilityLabel={`${percentage}% del presupuesto utilizado`} style={s.track}><View style={[s.fill,{width:`${Math.min(100,percentage)}%`,backgroundColor:percentage>=100?palette.expense:palette.primary}]}/></View><Text style={s.muted}>{summary.expenseMinor>budget?'Exceso: '+money(summary.expenseMinor-budget,currency):'Disponible: '+money(budget-summary.expenseMinor,currency)}</Text></>}
     <Field label="Nuevo límite mensual" value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" placeholder="Ejemplo: 20000"/>
     <View style={s.row}><Button label="Guardar presupuesto" disabled={busy} onPress={()=>void action(async()=>{const value=parseAmount(budgetInput);await persist({...localRef.current,budgets:{...localRef.current.budgets,[budgetKey]:value}});setBudgetInput('');setNotice('Presupuesto guardado.');})}/>{budget>0&&<Button label="Quitar límite" disabled={busy} onPress={()=>void action(async()=>{const budgets={...localRef.current.budgets};delete budgets[budgetKey];await persist({...localRef.current,budgets});})}/>}</View>
    </View>
    <View style={s.card}><Text style={s.title}>¿En qué estás gastando?</Text>{!categories.length&&<Text style={s.muted}>Todavía no hay gastos este mes en esta moneda.</Text>}{categories.map(c=><View key={c.category} style={{gap:8}}><View style={s.between}><Text style={s.text}>{c.category}</Text><Text style={s.text}>{money(c.amountMinor,currency)}</Text></View><View style={s.track}><View style={[s.fill,{width:`${Math.round(c.amountMinor/summary.expenseMinor*100)}%`}]}/></View></View>)}</View>
    <Text style={s.muted}>Las transferencias propias se excluyen de ingresos y gastos. En modo API los indicadores se calculan sobre los últimos 200 movimientos del mes.</Text>
   </>}
   {screen==='Movimientos'&&<>
    {editor&&<MovementForm key={editor==='new'?'new':editor.id} movement={editor==='new'?undefined:editor} currency={currency} month={month} onSave={saveMovement} onCancel={()=>setEditor(null)}/>}
    <Field label="Buscar descripción o categoría" value={search} onChangeText={setSearch} placeholder="Supermercado, transporte…"/>
    <View style={s.row}><Choice label="Todos" selected={type==='ALL'} onPress={()=>setType('ALL')}/>{(['INCOME','EXPENSE','TRANSFER'] as const).map(t=><Choice key={t} label={typeLabels[t]} selected={type===t} onPress={()=>setType(t)}/>)}</View>
    <View style={s.between}><Text style={s.title}>{visible.length} movimientos</Text><View style={s.row}>{connected&&<Button label="Actualizar" onPress={()=>void query.refetch()}/>}<Button label="Exportar CSV" disabled={!visible.length||busy} onPress={()=>void action(()=>exportCsv(visible,month))}/></View></View>
    {!visible.length&&<View style={s.card}><Text style={s.title}>No hay movimientos con estos filtros</Text><Text style={s.muted}>Cambia el mes, la moneda o añade tu primer movimiento.</Text></View>}
    {visible.map(m=><View key={m.id} style={s.card}><View style={s.between}><View><Text style={s.text}>{m.description}</Text><Text style={s.muted}>{m.category} · {m.occurredAt.slice(0,10)} · {typeLabels[m.type]}</Text></View><Text style={m.type==='INCOME'?s.income:m.type==='EXPENSE'?s.expense:s.amount}>{m.type==='EXPENSE'?'−':m.type==='INCOME'?'+':'↔'} {money(m.amountMinor,m.currency)}</Text></View>
     <View style={s.row}><Choice label={`Editar ${m.description}`} selected={false} onPress={()=>{setEditor(m);setDeleteId(null);}}/><Choice label="Eliminar" selected={false} onPress={()=>setDeleteId(m.id)}/></View>
     {deleteId===m.id&&<><Text style={s.error}>¿Eliminar este movimiento? Esta acción no se puede deshacer.</Text><View style={s.row}><Button label="Confirmar eliminación" disabled={busy} onPress={()=>void action(()=>remove(m.id))}/><Button label="Cancelar eliminación" disabled={busy} onPress={()=>setDeleteId(null)}/></View></>}
    </View>)}
   </>}
   {screen==='Ajustes'&&<>
    <View style={s.card}><Text style={s.title}>Conexión personal</Text><Text style={s.muted}>La demo se guarda localmente. La API guarda movimientos en PostgreSQL. Los datos de ambos modos se mantienen separados.</Text><Text style={s.text}>{url??'Sin URL configurada. Añade EXPO_PUBLIC_API_URL en apps/mobile/.env.'}</Text>
     {connected?<Button label="Desconectar y volver a demo" onPress={disconnect}/>:<><Field label="Token de desarrollo" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none"/><Button label="Conectar API" disabled={!url||token.length<24} onPress={()=>{client.clear();setSession(token);setToken('');setScreen('Resumen');}}/></>}
     <Text style={s.muted}>El token solo vive en memoria. Usa exclusivamente datos ficticios en esta fase.</Text>
    </View>
    <View style={s.card}><Text style={s.title}>Datos de demostración</Text><Text style={s.muted}>Restablece movimientos y presupuestos locales. Los datos de PostgreSQL no se eliminan.</Text><Button label={resetConfirm?'Confirmar restablecimiento local':'Restablecer demo'} disabled={busy||connected} onPress={()=>resetConfirm?void action(reset):setResetConfirm(true)}/>{resetConfirm&&<Button label="Cancelar restablecimiento" onPress={()=>setResetConfirm(false)}/>}</View>
    <View style={s.card}><Text style={s.title}>FlowSaldo 0.2</Text><Text style={s.muted}>Índigo, azul noche y lavanda. Una base personal para aprender, registrar y revisar tus movimientos. La sincronización bancaria, OAuth y conciliación siguen pendientes.</Text></View>
   </>}
  </>}
 </ScrollView></SafeAreaView>;
}
export default function App(){return <QueryClientProvider client={client}><Home/></QueryClientProvider>;}
