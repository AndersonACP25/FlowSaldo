import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { movementDate,selectedCategory,parseAmount, validDate, type Category, type Currency, type Movement, type MovementType } from '@flowsaldo/domain';
import { Button, Choice, Field } from './ui';
import { DatePicker } from './DatePicker';
import { styles as s } from './theme';
import type {FinancialAccount} from './FinancePanel';
export const typeLabels = { INCOME:'Ingreso', EXPENSE:'Gasto', TRANSFER:'Transferencia' };
export type Draft = Omit<Movement,'id'>;
export function MovementForm({movement,currency,month,onSave,onCancel,title,categories,recent=[],editing=false,fixedDate=false,saveLabel='Guardar movimiento',accounts}:{accounts?:FinancialAccount[];saveLabel?:string;fixedDate?:boolean;categories:Category[];recent?:string[];editing?:boolean;movement?:Movement;currency:Currency;month:string;onSave:(draft:Draft)=>Promise<void>;onCancel:()=>void;title?:string}) {
 const [accountId,setAccountId]=useState(movement?.accountId??'');const [targetAccountId,setTargetAccountId]=useState(movement?.targetAccountId??'');const [requestKey]=useState(()=>`manual-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
 const [description,setDescription]=useState(movement?.description??'');
 const [amount,setAmount]=useState(movement?String(movement.amountMinor/100):'');
 const today=new Date();const todayLabel=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const [date,setDate]=useState(movement?.occurredAt.slice(0,10)??movementDate(month,todayLabel));
 const [categoryId,setCategoryId]=useState(movement?.categoryId??categories.find(c=>c.normalizedName===(movement?.category??'Sin categorizar').toLocaleLowerCase('es'))?.id??'');
 const [type,setType]=useState<MovementType>(movement?.type??'EXPENSE');
 const [unit,setUnit]=useState<Currency>(movement?.currency??currency);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function save() {
  setError('');
  try {
   const amountMinor=parseAmount(amount);
   if(!description.trim()) throw new Error('Escribe una descripción.');
   if(!validDate(date)) throw new Error('Escribe una fecha válida: AAAA-MM-DD.');
   if(accounts&&type==='TRANSFER'&&accountId&&(!targetAccountId||targetAccountId===accountId))throw new Error('Selecciona otra cuenta de destino.');
   const category=selectedCategory(categories,categoryId,'Sin categorizar',editing?movement:undefined);
   setBusy(true);
   await onSave({description:description.trim(),amountMinor,occurredAt:date+'T12:00:00.000Z',...category,type,currency:unit,...(accounts?{accountId:accountId||null,targetAccountId:type==='TRANSFER'?(targetAccountId||null):null}:{}),...(!editing?{requestKey}:{} )});
  } catch(e) { setError(e instanceof Error?e.message:'No se pudo guardar.'); } finally { setBusy(false); }
 }
 return <View style={s.card}><Text style={s.title}>{title??(movement?'Editar movimiento':'Nuevo movimiento')}</Text>
  <View style={s.row}>{(['INCOME','EXPENSE','TRANSFER'] as const).map(t=><Choice key={t} label={typeLabels[t]} selected={type===t} onPress={()=>{setType(t);setTargetAccountId('');}}/>)}</View>
  <Field label="Descripción" value={description} onChangeText={setDescription} maxLength={100}/>
  <Field label="Monto (sin separadores de miles)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1250.50"/>
  <View style={s.row}>{(['DOP','USD'] as const).map(c=><Choice key={c} label={c} selected={unit===c} onPress={()=>{setUnit(c);setAccountId('');setTargetAccountId('');}}/>)}</View>
  {accounts&&<><Text style={s.label}>{type==='TRANSFER'?'Cuenta de origen':'Cuenta del movimiento'}</Text><Text style={s.muted}>Administra tus cuentas en Configuración. Sin cuenta conserva el registro fuera de los saldos y la conciliación.</Text><View style={s.row}><Choice label="Sin cuenta asignada" selected={!accountId} onPress={()=>{setAccountId('');setTargetAccountId('');}}/>{accounts.filter(a=>a.currency===unit&&(!a.archived||a.id===accountId)).map(a=><Choice key={a.id} label={`Cuenta: ${a.name}`} text={a.name+(a.archived?' · Archivada':'')} selected={accountId===a.id} onPress={()=>setAccountId(a.id)}/>)}</View>{type==='TRANSFER'&&!!accountId&&<><Text style={s.label}>Cuenta de destino</Text><View style={s.row}>{accounts.filter(a=>a.currency===unit&&a.id!==accountId&&!a.archived).map(a=><Choice key={a.id} label={`Destino: ${a.name}`} text={a.name} selected={targetAccountId===a.id} onPress={()=>setTargetAccountId(a.id)}/>)}</View><Text style={s.muted}>El pago de tarjeta o préstamo se registra aquí como transferencia; el destino reduce su deuda sin duplicar gastos.</Text></>}</>}
  {fixedDate?<Text style={s.muted}>Próximo vencimiento: {date}. Editar conserva el calendario original.</Text>:<DatePicker value={date} onChange={setDate}/>}
  <Text style={s.label}>Categoría</Text>
  <Text style={s.muted}>Selecciona una categoría activa. Puedes administrarlas en Configuración.</Text>
  {recent.length>0&&<><Text style={s.label}>Categorías recientes</Text><View style={s.row}>{categories.filter(c=>!c.archived&&recent.includes(c.id)).map(c=><Choice key={c.id} label={`Reciente: ${c.name}`} text={c.name} selected={categoryId===c.id} onPress={()=>setCategoryId(c.id)}/>)}</View></>}
  <View style={s.row}>{categories.filter(c=>!c.archived||(editing&&c.id===movement?.categoryId)).map(c=><Choice key={c.id} label={`Categoría: ${c.name}`} text={c.name+(c.archived?' · Archivada':'')} selected={categoryId===c.id} onPress={()=>setCategoryId(c.id)}/>)}</View>
  {type==='TRANSFER'&&<Text style={s.muted}>Transferencia entre cuentas propias: no cuenta como ingreso ni gasto.</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  <Button label={busy?'Guardando…':saveLabel} disabled={busy} onPress={()=>void save()}/>
  <Button label="Cancelar" disabled={busy} onPress={onCancel}/>
 </View>;
}
