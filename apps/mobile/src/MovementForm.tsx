import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { parseAmount, validDate, type Currency, type Movement, type MovementType } from '@flowsaldo/domain';
import { Button, Choice, Field } from './ui';
import { styles as s } from './theme';
export const typeLabels = { INCOME:'Ingreso', EXPENSE:'Gasto', TRANSFER:'Transferencia' };
export type Draft = Omit<Movement,'id'>;
export function MovementForm({movement,currency,month,onSave,onCancel,title}:{movement?:Movement;currency:Currency;month:string;onSave:(draft:Draft)=>Promise<void>;onCancel:()=>void;title?:string}) {
 const [description,setDescription]=useState(movement?.description??'');
 const [amount,setAmount]=useState(movement?String(movement.amountMinor/100):'');
 const [date,setDate]=useState(movement?.occurredAt.slice(0,10)??`${month}-01`);
 const [category,setCategory]=useState(movement?.category??'Sin categorizar');
 const [type,setType]=useState<MovementType>(movement?.type??'EXPENSE');
 const [unit,setUnit]=useState<Currency>(movement?.currency??currency);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function save() {
  setError('');
  try {
   const amountMinor=parseAmount(amount);
   if(!description.trim()) throw new Error('Escribe una descripción.');
   if(!validDate(date)) throw new Error('Escribe una fecha válida: AAAA-MM-DD.');
   if(!category.trim()) throw new Error('Escribe o selecciona una categoría.');
   setBusy(true);
   await onSave({description:description.trim(),amountMinor,occurredAt:date+'T12:00:00.000Z',category:category.trim(),type,currency:unit});
  } catch(e) { setError(e instanceof Error?e.message:'No se pudo guardar.'); } finally { setBusy(false); }
 }
 return <View style={s.card}><Text style={s.title}>{title??(movement?'Editar movimiento':'Nuevo movimiento')}</Text>
  <View style={s.row}>{(['INCOME','EXPENSE','TRANSFER'] as const).map(t=><Choice key={t} label={typeLabels[t]} selected={type===t} onPress={()=>setType(t)}/>)}</View>
  <Field label="Descripción" value={description} onChangeText={setDescription} maxLength={100}/>
  <Field label="Monto (sin separadores de miles)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1250.50"/>
  <View style={s.row}>{(['DOP','USD'] as const).map(c=><Choice key={c} label={c} selected={unit===c} onPress={()=>setUnit(c)}/>)}</View>
  <Field label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} maxLength={10} placeholder="2026-10-22"/>
  <Field label="Categoría" value={category} onChangeText={setCategory} maxLength={60}/>
  <View style={s.row}>{['Alimentación','Transporte','Servicios','Salario','Ocio'].map(c=><Choice key={c} label={c} selected={category===c} onPress={()=>setCategory(c)}/>)}</View>
  {type==='TRANSFER'&&<Text style={s.muted}>Transferencia entre cuentas propias: no cuenta como ingreso ni gasto.</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  <Button label={busy?'Guardando…':'Guardar movimiento'} disabled={busy} onPress={()=>void save()}/>
  <Button label="Cancelar" disabled={busy} onPress={onCancel}/>
 </View>;
}
