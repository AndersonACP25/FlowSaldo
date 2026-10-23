import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Button, Field, Choice } from './ui';
import { styles as s } from './theme';
export type AuthRoute='login'|'register';
export function AuthPreview({route,onRoute,onDemo}:{route:AuthRoute;onRoute:(route:AuthRoute)=>void;onDemo:()=>void}){
 const register=route==='register';
 return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{maxWidth:520,paddingTop:48}]}>
  <Text style={s.brand}>FlowSaldo ⤴</Text><Text style={s.muted}>Tus finanzas, en orden.</Text>
  <View style={s.banner}><Text style={s.text}>Vista previa de acceso</Text><Text style={s.muted}>Estas pantallas todavía no autentican ni crean cuentas. Utiliza datos ficticios; los campos no se envían ni se guardan.</Text></View>
  <View style={s.card}><Text style={s.title}>{register?'Crear cuenta':'Iniciar sesión'}</Text><Text style={s.muted}>{register?'Un espacio para organizar tu dinero.':'Continúa con tu espacio financiero.'}</Text>
   {register&&<Field label="Nombre" placeholder="Nombre de ejemplo" autoComplete="off" maxLength={60}/>}
   <Field label="Correo electrónico" placeholder="ejemplo@correo.test" keyboardType="email-address" autoCapitalize="none" autoComplete="off" maxLength={120}/>
   <Field label="Contraseña" placeholder="Solo datos ficticios" secureTextEntry autoComplete="off"/>
   {register&&<Field label="Confirmar contraseña" secureTextEntry autoComplete="off"/>}
   <Button label={register?'Crear cuenta (próximamente)':'Entrar (próximamente)'} disabled onPress={()=>undefined}/>
   <Text style={s.muted}>{register?'¿Ya tienes una cuenta?':'¿Todavía no tienes una cuenta?'}</Text>
   <Choice label={register?'Ir a iniciar sesión':'Ir a crear cuenta'} selected={false} onPress={()=>onRoute(register?'login':'register')}/>
  </View>
  <Button label="Explorar demostración" onPress={onDemo}/><Text style={s.muted}>La demostración permite probar el proyecto sin iniciar sesión.</Text>
 </ScrollView></SafeAreaView>;
}
