import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {Button,Field} from './ui';
import {styles as s} from './theme';
import {accessRequest,type PersonalSession} from './access';
export function PersonalAccount({session,onLogout,onPasswordChanged}:{session:PersonalSession;onLogout:()=>Promise<void>;onPasswordChanged:()=>Promise<void>}){
 const [current,setCurrent]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const [sessions,setSessions]=useState<Array<{id:string;createdAt:string;expiresAt:string;current:boolean}>|null>(null);
 async function run(work:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}}
 return <View style={s.card}><Text style={s.title}>Cuenta personal</Text><Text style={s.text}>{session.owner.name} · {session.owner.email}</Text><Text style={s.muted}>La sesión vence (UTC): {session.expiresAt.slice(0,19).replace('T',' ')}. En web se conserva solo mientras esta pestaña permanece abierta.</Text>
 <View style={s.row}><Button label="Cerrar sesión" disabled={busy} onPress={()=>void run(onLogout)}/><Button label="Consultar sesiones activas" disabled={busy} onPress={()=>void run(async()=>setSessions(await accessRequest('/auth/sessions',undefined,session.token)))}/><Button label="Cerrar otras sesiones" disabled={busy} onPress={()=>void run(async()=>{await accessRequest('/auth/sessions/revoke-others',{},session.token);setSessions(null);setNotice('Las otras sesiones se revocaron. Esta sesión continúa abierta.');})}/></View>
 {sessions&&sessions.map(item=><Text key={item.id} style={s.muted}>{item.current?'Esta sesión':'Otra sesión'} · Creada (UTC): {item.createdAt.slice(0,19).replace('T',' ')} · Vence: {item.expiresAt.slice(0,19).replace('T',' ')}</Text>)}
 <Text style={s.title}>Cambiar contraseña</Text><Field label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/><Field label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/><Field label="Confirmar nueva contraseña" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/><Text style={s.muted}>Al menos 15 caracteres. Cambiarla cierra todas las sesiones y requiere iniciar sesión otra vez.</Text>
 <Button label="Guardar nueva contraseña" disabled={busy||!current||!password} onPress={()=>void run(async()=>{if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');if(password.length<15)throw new Error('Usa una contraseña de al menos 15 caracteres.');await accessRequest('/auth/password',{currentPassword:current,newPassword:password},session.token);setCurrent('');setPassword('');setConfirmation('');await onPasswordChanged();})}/>
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
 </View>;
}
