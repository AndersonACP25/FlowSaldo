import React, { useState } from 'react';
import { Text, View, Switch } from 'react-native';
import { Button, Choice } from './ui';
import type { AuthRoute } from './AuthPreview';
import type { Preferences } from './preferences';
import { styles as s, palette } from './theme';
export function AccountSettings({preferences,onSave,onAuth}:{preferences:Preferences;onSave:(value:Preferences)=>Promise<void>;onAuth:(route:AuthRoute)=>void}){
 const [draft,setDraft]=useState(preferences);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 async function save(){setBusy(true);setMessage('');setError('');try{await onSave(draft);setMessage('Preferencias guardadas en este dispositivo.');}catch{setError('No se pudieron guardar las preferencias. Inténtalo nuevamente.');}finally{setBusy(false);}}
 return <View style={{gap:16}}><Text style={s.title}>Configuración</Text>
  <View style={s.card}><Text style={s.title}>Tu cuenta</Text><Text style={s.muted}>Estás explorando una demostración. La gestión de cuenta estará disponible cuando se active la autenticación.</Text><View style={s.row}><Button label="Ver inicio de sesión" onPress={()=>onAuth('login')}/><Choice label="Ver registro" selected={false} onPress={()=>onAuth('register')}/></View></View>
  <View style={s.card}><Text style={s.title}>Preferencias locales</Text><Text style={s.label}>Moneda predeterminada</Text><View style={s.row}>{(['DOP','USD'] as const).map(currency=><Choice key={currency} label={currency} selected={draft.currency===currency} onPress={()=>setDraft({...draft,currency})}/>)}</View>
   <View style={s.between}><View style={{flex:1,minWidth:180}}><Text style={s.text}>Ocultar importes</Text><Text style={s.muted}>Oculta cifras en las consultas. Los archivos exportados y formularios conservan sus valores.</Text></View><Switch accessibilityLabel="Ocultar importes" value={draft.hideAmounts} onValueChange={hideAmounts=>setDraft({...draft,hideAmounts})} trackColor={{false:palette.border,true:palette.primary}}/></View>
   <Button label={busy?'Guardando preferencias…':'Guardar preferencias'} disabled={busy} onPress={()=>void save()}/>
   {!!message&&<Text accessibilityLiveRegion="polite" style={s.success}>{message}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>
  <View style={s.card}><Text style={s.title}>Seguridad y datos de la cuenta</Text><Text style={s.muted}>Estas opciones requieren una cuenta real y todavía no están disponibles.</Text><Button label="Cambiar contraseña (próximamente)" disabled onPress={()=>undefined}/><Button label="Eliminar cuenta (próximamente)" disabled onPress={()=>undefined}/></View>
  <View style={s.card}><Text style={s.title}>Idioma y apariencia</Text><Text style={s.text}>Español · Tema oscuro</Text><Text style={s.muted}>La selección de otros idiomas y temas se incorporará en una próxima versión.</Text></View>
 </View>;
}
