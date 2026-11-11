import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {Button,Field} from './ui';
import {styles as s} from './theme';
import {accessRequest} from './access';
interface Preview {previewId:string;hasMore:boolean;totalEligible:number;expiresAt:string;cutoff:string;reviewBodies:number;failedBodies:number;lastCleanup:{createdAt:string;reviewBodies:number;failedBodies:number}|null}
export function DataRetention({token,onApplied}:{token:string;onApplied:()=>Promise<void>}){
 const [days,setDays]=useState('30');const [preview,setPreview]=useState<Preview|null>(null);const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 async function run(work:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la limpieza.');}finally{setBusy(false);}}
 return <View style={s.card}><Text style={s.title}>Privacidad y contenido antiguo</Text><Text style={s.muted}>Elimina manualmente el texto original de avisos antiguos Por revisar o Con error y los descarta. No elimina movimientos, categorías, presupuestos, recurrencias ni trabajos en cola o procesándose. El contenido eliminado no se puede recuperar.</Text>
 <Field label="Antigüedad mínima en días" value={days} onChangeText={value=>{setDays(value);setPreview(null);setConfirmation('');setPassword('');}} keyboardType="number-pad" maxLength={3}/>
 <Button label="Previsualizar limpieza" disabled={busy} onPress={()=>void run(async()=>{if(!/^\d+$/.test(days)||Number(days)<7||Number(days)>365)throw new Error('Selecciona de 7 a 365 días.');setPreview(await accessRequest('/auth/data/retention/preview',{olderThanDays:Number(days)},token));})}/>
 {preview&&<><Text style={s.text}>Por revisar: {preview.reviewBodies} · Con error: {preview.failedBodies}</Text><Text style={s.muted}>Solo antes de {preview.cutoff.slice(0,19).replace('T',' ')} UTC. Los avisos que se resuelvan o reencolen después de esta vista previa se conservarán.</Text>
 {preview.hasMore&&<Text style={s.muted}>Se incluyen hasta 1000 avisos por lote. Repite la vista previa para los restantes.</Text>}
 <Text style={s.muted}>Esta vista previa vence en 10 minutos y se utiliza una sola vez.</Text>
 {preview.lastCleanup&&<Text style={s.muted}>Última limpieza (UTC): {preview.lastCleanup.createdAt.slice(0,19).replace('T',' ')}</Text>}
 <Text style={s.muted}>También se eliminan sesiones/códigos de recuperación caducados o revocados y registros antiguos de limitación de acceso. La sesión actual y los códigos vigentes se conservan.</Text>
 <Field label="Contraseña para confirmar limpieza" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/><Field label="Escribe ELIMINAR CONTENIDO" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} maxLength={30}/>
 <Button label="Confirmar limpieza de contenido" disabled={busy||!password||confirmation!=='ELIMINAR CONTENIDO'} onPress={()=>void run(async()=>{const result=await accessRequest('/auth/data/retention/apply',{previewId:preview.previewId,currentPassword:password,confirmation},token);setPassword('');setConfirmation('');setPreview(null);setNotice(`Contenido eliminado: ${result.reviewBodies} por revisar y ${result.failedBodies} con error. Movimientos conservados.`);await onApplied();})}/></>}
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
 </View>;
}
