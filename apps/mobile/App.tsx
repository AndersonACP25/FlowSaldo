import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { countLabel, pendingMailMessage, categoryExpenses, demoMovements, filterMovements, parseAmount, summarize, type Movement, type Currency, type MovementType } from '@flowsaldo/domain';
import { styles as s, palette } from './src/theme';
import { Button, Choice, Field } from './src/ui';
import { MovementForm, type Draft, typeLabels } from './src/MovementForm';
import { loadLocal, saveLocal, type LocalData } from './src/storage';
import { ReviewInbox } from './src/ReviewInbox';
import { demoReviews, type ReviewItem } from './src/reviews';
import { WeeklyFlow } from './src/WeeklyFlow';
import { AuthPreview, type AuthRoute } from './src/AuthPreview';
import { AccountSettings } from './src/AccountSettings';
import { defaultPreferences, loadPreferences, savePreferences, type Preferences } from './src/preferences';
import { exportCsv } from './src/exportCsv';
const client=new QueryClient();
const formatMoney=(minor:number,currency:Currency)=>`${currency} ${(minor/100).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function currentMonth() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function shiftMonth(month:string,delta:number) { const [year,m]=month.split('-').map(Number); const d=new Date(year,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function initialData():LocalData { return {movements:demoMovements.map(m=>({...m,occurredAt:currentMonth()+m.occurredAt.slice(7)})),budgets:{},reviews:demoReviews()}; }
function Home({onAuth}:{onAuth:(route:AuthRoute)=>void}) {
 const [preferences,setPreferences]=useState<Preferences>(defaultPreferences);
 useEffect(()=>{void loadPreferences().then(value=>{setPreferences(value);setCurrency(value.currency);}).catch(()=>setError('No se pudieron cargar las preferencias locales.'));},[]);
 const money=(minor:number,unit:Currency)=>preferences.hideAmounts?`${unit} ••••`:formatMoney(minor,unit);
 const [local,setLocal]=useState<LocalData>(initialData); const localRef=useRef(local);
 const [ready,setReady]=useState(false); const [loadError,setLoadError]=useState('');
 const [currency,setCurrency]=useState<Currency>('DOP'); const [month,setMonth]=useState(currentMonth);
 const [screen,setScreen]=useState<'Panel'|'Movimientos'|'Por revisar'|'Conexiones'|'Configuración'>('Panel');
 const [search,setSearch]=useState('');const [type,setType]=useState<MovementType|'ALL'>('ALL');
 const [editor,setEditor]=useState<Movement|'new'|null>(null);const [deleteId,setDeleteId]=useState<string|null>(null);
 const [token,setToken]=useState('');const [session,setSession]=useState('');
 const [notice,setNotice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [budgetInput,setBudgetInput]=useState('');const [resetConfirm,setResetConfirm]=useState(false);
 const [sampleId,setSampleId]=useState('');const [sampleBody,setSampleBody]=useState('Aviso de prueba sin formato reconocido');
 const url=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,''); const connected=!!session;
 useEffect(()=>{let active=true; void loadLocal().then(data=>{if(active){if(data){localRef.current=data;setLocal(data);}setReady(true);}}).catch(()=>{if(active)setLoadError('No se pudieron leer los datos locales. No se sobrescribieron. Puedes reintentar recargando o restablecer la demo.');});return()=>{active=false;};},[]);
 async function persist(next:LocalData) { await saveLocal(next);localRef.current=next;setLocal(next); }
 async function request(path:string,options:RequestInit={}) {
  const response=await fetch(`${url}${path}`,{...options,headers:{Authorization:`Bearer ${session}`,'Content-Type':'application/json'}});
  if(!response.ok) {const data=await response.json().catch(()=>null);throw new Error(data?.error??'No se pudo conectar con la API.');}
  return response.status===204?null:response.json();
 }
 const query=useQuery({queryKey:['movements',connected,month,currency],enabled:connected,retry:false,queryFn:async():Promise<Movement[]>=>request(`/movements?month=${month}&currency=${currency}`)});
 const imports=useQuery({queryKey:['imports',connected],enabled:connected,retry:false,queryFn:async():Promise<ReviewItem[]>=>request('/imports')});
 const reviews=connected?(imports.data??[]):local.reviews;
 const pending=reviews.filter(i=>i.status==='REVIEW').length;
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
 async function resolveReview(id:string,draft:Draft) {
  if(connected) {await request(`/imports/${id}/resolve`,{method:'POST',body:JSON.stringify(draft)});await Promise.all([client.invalidateQueries({queryKey:['imports']}),client.invalidateQueries({queryKey:['movements']})]);}
  else {
   const review=localRef.current.reviews.find(i=>i.id===id);
   if(review?.status!=='REVIEW') throw new Error('Este correo ya fue revisado.');
   await persist({...localRef.current,movements:[{...draft,id:`reviewed-${id}`},...localRef.current.movements],reviews:localRef.current.reviews.map(i=>i.id===id?{...i,status:'PARSED' as const,body:''}:i)});
  }
  setNotice('Revisión confirmada. Movimiento registrado.');
 }
 async function discardReview(id:string) {
  if(connected) {await request(`/imports/${id}/dismiss`,{method:'POST'});await client.invalidateQueries({queryKey:['imports']});}
  else await persist({...localRef.current,reviews:localRef.current.reviews.map(i=>i.id===id?{...i,status:'DISMISSED' as const,body:''}:i)});
  setNotice('Correo descartado sin contabilizar.');
 }
 async function reset() {const next=initialData();await persist(next);setLoadError('');setReady(true);setResetConfirm(false);setNotice('Demo restablecida.');}
 function disconnect(){setSession('');setToken('');client.clear();setEditor(null);setDeleteId(null);setNotice('Sesión cerrada. Volviste a la demo local.');}
 return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <View style={s.between}><View><Text style={s.brand}>FlowSaldo ⤴</Text><Text style={s.muted}>Tus finanzas, en orden.</Text></View><Choice label="Configuración" text="⚙" selected={screen==='Configuración'} onPress={()=>{setEditor(null);setScreen('Configuración');}}/><Button label="+ Nuevo movimiento" text="+ Añadir" disabled={!ready||busy||!!editor} onPress={()=>{setEditor('new');setScreen('Movimientos');setError('');setNotice('');}}/></View>
  <View style={s.banner}><Text style={s.text}>{connected?'API personal · máximo 200 movimientos del mes':'Demo · datos ficticios en este dispositivo'}</Text><Text style={s.muted}>Correo bancario sin conectar.</Text></View>
  {!ready&&!loadError&&<ActivityIndicator color={palette.primary}/>}
  {!!loadError&&<View style={s.card}><Text style={s.error}>{loadError}</Text><Button label={resetConfirm?'Confirmar borrado local y restablecer':'Restablecer datos locales'} onPress={()=>resetConfirm?void action(reset):setResetConfirm(true)}/></View>}
  {ready&&<>

   {!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
   {(screen==='Panel'||screen==='Movimientos')&&<View style={s.between}><View style={s.row}><Choice label="‹ Mes anterior" text="‹" selected={false} onPress={()=>setMonth(shiftMonth(month,-1))}/><Text style={s.title}>{month}</Text><Choice label="Mes siguiente ›" text="›" selected={false} onPress={()=>setMonth(shiftMonth(month,1))}/></View><View style={s.row}>{(['DOP','USD'] as const).map(c=><Choice key={c} label={c} selected={currency===c} onPress={()=>setCurrency(c)}/>)}</View></View>}
   {connected&&query.isFetching&&<ActivityIndicator color={palette.primary}/>}
   {connected&&query.error&&<View style={s.card}><Text accessibilityRole="alert" style={s.error}>{query.error.message}</Text><Button label="Reintentar" onPress={()=>void query.refetch()}/></View>}
   {screen==='Panel'&&<>

    <View style={s.hero}><Text style={s.white}>Diferencia registrada · {month}</Text><Text style={s.heroValue}>{money(summary.differenceMinor,currency)}</Text><Text style={s.white}>Ingresos menos gastos. No equivale al saldo del banco.</Text></View>
    <View style={s.metrics}><View style={s.metric}><Text style={s.muted}>Ingresos</Text><Text style={s.income}>{money(summary.incomeMinor,currency)}</Text></View><View style={s.metric}><Text style={s.muted}>Gastos</Text><Text style={s.expense}>{money(summary.expenseMinor,currency)}</Text></View><View style={s.metric}><Text style={s.muted}>Movimientos</Text><Text style={s.amount}>{period.length}</Text></View></View>
    {pending>0&&<View style={[s.card,{borderColor:'#53412b'}]}><View style={s.between}><Text style={s.text}>{pendingMailMessage(pending)}</Text><Button label="Ir a revisiones" onPress={()=>setScreen('Por revisar')}/></View><Text style={s.muted}>Revisa los datos antes de incorporarlos a tus movimientos.</Text></View>}
    {preferences.hideAmounts?<View style={s.card}><Text style={s.muted}>Flujo semanal oculto por tu preferencia de privacidad.</Text></View>:<WeeklyFlow rows={period} month={month} currency={currency}/>}
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
    <View style={s.between}><Text style={s.title}>{countLabel(visible.length,'movimiento','movimientos')}</Text><View style={s.row}>{connected&&<Button label="Actualizar" onPress={()=>void query.refetch()}/>}<Button label="Exportar CSV" disabled={!visible.length||busy} onPress={()=>void action(()=>exportCsv(visible,month))}/></View></View>
    {!visible.length&&<View style={s.card}><Text style={s.title}>No hay movimientos con estos filtros</Text><Text style={s.muted}>Cambia el mes, la moneda o añade tu primer movimiento.</Text></View>}
    {visible.map(m=><View key={m.id} style={s.card}><View style={s.between}><View><Text style={s.text}>{m.description}</Text><Text style={s.muted}>{m.category} · {m.occurredAt.slice(0,10)} · {typeLabels[m.type]}</Text></View><Text style={m.type==='INCOME'?s.income:m.type==='EXPENSE'?s.expense:s.amount}>{m.type==='EXPENSE'?'−':m.type==='INCOME'?'+':'↔'} {money(m.amountMinor,m.currency)}</Text></View>
     <View style={s.row}><Choice label={`Editar ${m.description}`} selected={false} onPress={()=>{setEditor(m);setDeleteId(null);}}/><Choice label="Eliminar" selected={false} onPress={()=>setDeleteId(m.id)}/></View>
     {deleteId===m.id&&<><Text style={s.error}>¿Eliminar este movimiento? Esta acción no se puede deshacer.</Text><View style={s.row}><Button label="Confirmar eliminación" disabled={busy} onPress={()=>void action(()=>remove(m.id))}/><Button label="Cancelar eliminación" disabled={busy} onPress={()=>setDeleteId(null)}/></View></>}
    </View>)}
   </>}
   {screen==='Configuración'&&<AccountSettings preferences={preferences} onAuth={onAuth} onSave={async value=>{await savePreferences(value);setPreferences(value);setCurrency(value.currency);}}/>}
   {screen==='Por revisar'&&<>
    {connected&&imports.isFetching&&<ActivityIndicator color={palette.primary}/>}
    {connected&&imports.error&&<Text style={s.error}>{imports.error.message}</Text>}
    {connected&&<Button label="Actualizar revisiones" onPress={()=>void imports.refetch()}/>}
    {(!connected||!imports.error)&&<ReviewInbox items={reviews} month={month} currency={currency} onResolve={resolveReview} onDiscard={discardReview} onOriginal={async id=>(await request(`/imports/${id}`)).body}/>}
   </>}
   {screen==='Conexiones'&&<>
    <Text style={s.title}>Centro de conexiones</Text>
    <View style={s.card}><Text style={s.eyebrow}>PROVEEDORES DE CORREO</Text>{['Gmail Personal','Outlook'].map(provider=><View key={provider} style={s.between}><Text style={s.text}>{provider}</Text><Text style={s.muted}>Próximamente · sin conectar</Text></View>)}<Text style={s.muted}>OAuth aún no está implementado. Esta versión no accede a tu buzón ni utiliza IA para clasificar correos.</Text></View>

    <View style={s.card}><Text style={s.title}>Conexión personal</Text><Text style={s.muted}>La demo se guarda localmente. La API guarda movimientos en PostgreSQL. Los datos de ambos modos se mantienen separados.</Text><Text style={s.text}>{url??'Sin URL configurada. Añade EXPO_PUBLIC_API_URL en apps/mobile/.env.'}</Text>
     {connected?<Button label="Desconectar y volver a demo" onPress={disconnect}/>:<><Field label="Token de desarrollo" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none"/><Button label="Conectar API" disabled={!url||token.length<24} onPress={()=>{client.clear();setSession(token);setToken('');setScreen('Panel');}}/></>}
     <Text style={s.muted}>El token solo vive en memoria. Usa exclusivamente datos ficticios en esta fase.</Text>
    </View>
    {connected&&<View style={s.card}><Text style={s.title}>Laboratorio de correo sintético</Text><Text style={s.muted}>Envía un aviso de prueba al worker. Un formato desconocido aparecerá en Por revisar cuando el worker lo procese.</Text><Field label="Identificador del correo de prueba" value={sampleId} onChangeText={setSampleId} maxLength={200}/><Field label="Contenido sintético" value={sampleBody} onChangeText={setSampleBody} maxLength={10000} multiline/><Button label="Encolar correo de prueba" disabled={busy||!sampleId.trim()||!sampleBody.trim()} onPress={()=>void action(async()=>{await request('/imports',{method:'POST',body:JSON.stringify({externalId:sampleId.trim(),body:sampleBody})});await client.invalidateQueries({queryKey:['imports']});setNotice('Correo encolado. Espera al worker y actualiza revisiones.');})}/></View>}
    <View style={s.card}><Text style={s.title}>Datos de demostración</Text><Text style={s.muted}>Restablece movimientos y presupuestos locales. Los datos de PostgreSQL no se eliminan.</Text><Button label={resetConfirm?'Confirmar restablecimiento local':'Restablecer demo'} disabled={busy||connected} onPress={()=>resetConfirm?void action(reset):setResetConfirm(true)}/>{resetConfirm&&<Button label="Cancelar restablecimiento" onPress={()=>setResetConfirm(false)}/>}</View>
    <View style={s.card}><Text style={s.title}>FlowSaldo 0.5</Text><Text style={s.muted}>Dark Slate, esmeralda y cian, según DESIGN.md. Una base personal para aprender, registrar y revisar tus movimientos. La sincronización bancaria, OAuth y conciliación siguen pendientes.</Text></View>
   </>}
  </>}
 </ScrollView>
 {ready&&<View style={s.nav}>{(['Panel','Movimientos','Por revisar','Conexiones'] as const).map((item,index)=><Pressable key={item} accessibilityRole="button" accessibilityLabel={item} accessibilityState={{selected:screen===item}} onPress={()=>{setScreen(item);setEditor(null);setDeleteId(null);}} style={[s.navItem,screen===item&&s.navActive]}><View style={s.row}><Text style={{color:screen===item?palette.primary:palette.muted,fontSize:20}}>{['▦','⇄','☑','⌘'][index]}</Text>{item==='Por revisar'&&pending>0&&<Text style={s.badge}>{pending}</Text>}</View><Text style={[s.navText,screen===item&&{color:palette.income}]}>{item}</Text></Pressable>)}</View>}
 </SafeAreaView>;
}
export default function App(){
 const [route,setRoute]=useState<AuthRoute|'demo'>('login');
 function openAuth(next:AuthRoute){client.clear();setRoute(next);}
 return <QueryClientProvider client={client}>{route==='demo'?<Home onAuth={openAuth}/>:<AuthPreview key={route} route={route} onRoute={setRoute} onDemo={()=>setRoute('demo')}/>}</QueryClientProvider>;
}
