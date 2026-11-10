import React,{useState} from 'react';
import {SafeAreaView,ScrollView,Text,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {Button,Field,Choice} from './ui';
import {styles as s} from './theme';
import {accessRequest,type PersonalSession} from './access';
export type AuthRoute='login'|'register'|'recover';
export function AuthScreen({route,onRoute,onDemo,onSession,onRecovered,notice}:{onRecovered:()=>Promise<void>;route:AuthRoute;onRoute:(route:AuthRoute)=>void;onDemo:()=>void;onSession:(session:PersonalSession)=>Promise<void>;notice?:string}){
 const register=route==='register';const recover=route==='recover';const [code,setCode]=useState('');const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [setupToken,setSetupToken]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 async function submit(){setBusy(true);setError('');setMessage('');try{
  if(register){if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');if(password.length<15)throw new Error('Usa una contraseña de al menos 15 caracteres.');await accessRequest('/auth/setup',{name,email,password},setupToken);setPassword('');setConfirmation('');setSetupToken('');setMessage('Cuenta personal creada. Ahora inicia sesión.');}
  else if(recover){if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');await accessRequest('/auth/recover',{email,code:code.trim(),newPassword:password});setCode('');setPassword('');setConfirmation('');await onRecovered();}
  else {const session:PersonalSession=await accessRequest('/auth/login',{email,password});setPassword('');await onSession(session);}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo completar el acceso.');}finally{setBusy(false);}}
 return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{maxWidth:520,paddingTop:48}]}>
 <Text style={s.brand}>FlowSaldo ⤴</Text><Text style={s.muted}>Tus finanzas, en orden.</Text>
 <View style={s.banner}><Text style={s.text}>Acceso personal</Text><Text style={s.muted}>Una cuenta por instalación. El proyecto sigue usando datos ficticios; las conexiones bancarias y la recuperación por correo están pendientes.</Text></View>
 {!!notice&&<Text style={s.muted}>{notice}</Text>}
 <View style={s.card}><Text style={s.title}>{register?'Crear cuenta personal':recover?'Recuperar cuenta':'Iniciar sesión'}</Text>
 {register&&<><Field label="Nombre" value={name} onChangeText={setName} maxLength={60}/><Field label="Token de configuración inicial" value={setupToken} onChangeText={setSetupToken} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={300}/><Text style={s.muted}>Usa el token configurado por el administrador para asociar la cuenta inicial a los datos existentes. No se pueden crear cuentas adicionales.</Text></>}
 <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="off" maxLength={120}/>
 {recover&&<Field label="Código de recuperación" value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={80}/>}
 <Field label={recover?"Nueva contraseña de recuperación":"Contraseña"} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/>
 {(register||recover)&&<><Text style={s.muted}>Al menos 15 caracteres. No se recorta la contraseña.</Text><Field label="Confirmar contraseña" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128}/></>}
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!message&&<Text accessibilityLiveRegion="polite" style={s.success}>{message}</Text>}
 <Button label={busy?'Validando acceso…':register?'Crear cuenta personal':recover?'Restablecer contraseña':'Entrar'} disabled={busy||!email||!password||(register&&(!name.trim()||!setupToken))||(recover&&!code)} onPress={()=>void submit()}/>
 <Choice label={register||recover?'Ir a iniciar sesión':'Configurar cuenta inicial'} selected={false} onPress={()=>onRoute(register||recover?'login':'register')}/>
 {route==='login'&&<Choice label="Recuperar cuenta con código" selected={false} onPress={()=>onRoute('recover')}/>}
 {recover&&<Text style={s.muted}>Usa un código guardado previamente. Recuperar cierra todas las sesiones e invalida el lote completo. No se enviará ningún correo.</Text>}
 </View><Button label="Explorar demostración" disabled={busy} onPress={onDemo}/><Text style={s.muted}>La demostración continúa disponible sin iniciar sesión y conserva sus datos locales.</Text>
 </ScrollView></SafeAreaView>;
}
