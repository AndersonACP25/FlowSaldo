import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { countLabel, type Category, type Currency } from '@flowsaldo/domain';
import { MovementForm, type Draft } from './MovementForm';
import type { ReviewItem } from './reviews';
import { Button, Choice } from './ui';
import { styles as s, palette } from './theme';
export function ReviewInbox({items,currency,month,onResolve,onDiscard,onOriginal,total,showHistory=false,categories}:{categories:Category[];total?:number;showHistory?:boolean;items:ReviewItem[];currency:Currency;month:string;onResolve:(id:string,draft:Draft)=>Promise<void>;onDiscard:(id:string)=>Promise<void>;onOriginal:(id:string)=>Promise<string>}) {
 const [editing,setEditing]=useState<string|null>(null);const [discard,setDiscard]=useState<string|null>(null);
 const [original,setOriginal]=useState<Record<string,string>>({});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const pending=showHistory?items:items.filter(i=>i.status==='REVIEW');
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la revisión.');}finally{setBusy(false);}}
 return <View style={{gap:16}}><View><Text style={s.eyebrow}>TU CRITERIO ES PRIMERO</Text><Text style={s.title}>{showHistory?countLabel(total??pending.length,'correo','correos'):countLabel(total??pending.length,'movimiento','movimientos')+' por confirmar'}</Text><Text style={s.muted}>Ningún pendiente afecta tus totales hasta que confirmes todos sus datos.</Text></View>
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 {!pending.length&&<View style={s.card}><Text style={s.income}>Sin resultados</Text><Text style={s.muted}>No hay correos con estos filtros.</Text></View>}
 {pending.map(item=><View key={item.id} style={[s.card,{borderColor:'#2d3748'}]}><View style={s.between}><Text style={s.title}>{item.suggestion?.description??item.externalId}</Text><Text style={{color:palette.amber}}>{({REVIEW:'● Por revisar',PENDING:'En proceso',PARSED:'Confirmado',DISMISSED:'Descartado'})[item.status]}</Text></View>
 {!!item.createdAt&&<Text style={s.muted}>Recibido: {item.createdAt.slice(0,10)}</Text>}
 <View style={[s.banner,{backgroundColor:palette.raised}]}><Text style={s.muted}>{item.reason??'Revisión manual necesaria'}</Text></View>
 {item.status==='REVIEW'&&(editing===item.id?<MovementForm categories={categories} title="Confirmar movimiento" movement={item.suggestion} currency={currency} month={month} onSave={async draft=>{await onResolve(item.id,draft);setEditing(null);}} onCancel={()=>setEditing(null)}/>:<View style={s.row}><Button label="Revisar y confirmar" disabled={busy} onPress={()=>setEditing(item.id)}/><Choice label="Descartar" selected={false} onPress={()=>setDiscard(item.id)}/></View>)}
 {discard===item.id&&<><Text style={s.error}>¿Descartar este correo sin crear un movimiento?</Text><View style={s.row}><Button label="Confirmar descarte" disabled={busy} onPress={()=>void run(async()=>{await onDiscard(item.id);setDiscard(null);})}/><Button label="Cancelar descarte" onPress={()=>setDiscard(null)}/></View></>}
 <Choice label={original[item.id]?'Ocultar correo de prueba':'Ver correo de prueba'} selected={!!original[item.id]} onPress={()=>void run(async()=>{if(original[item.id])setOriginal(prev=>({...prev,[item.id]:''}));else {const body=item.body??await onOriginal(item.id);setOriginal(prev=>({...prev,[item.id]:body||'Sin contenido disponible.'}));}})}/>
 {!!original[item.id]&&<Text selectable style={s.muted}>{original[item.id]}</Text>}
 </View>)}
 </View>;
}
