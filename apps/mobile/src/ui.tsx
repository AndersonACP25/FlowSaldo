import React, {useEffect, useState} from 'react';
import {IconButton} from './IconButton';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { styles as s, palette } from './theme';
export function Button({label,onPress,disabled=false,text}:{label:string;onPress:()=>void;disabled?:boolean;text?:string}) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.button,disabled&&s.disabled]}><Text style={s.buttonText}>{text??label}</Text></Pressable>; }
export function Choice({label,selected,onPress,text,compact=false}:{compact?:boolean;label:string;selected:boolean;onPress:()=>void;text?:string}) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={[s.pill,compact&&{paddingHorizontal:0},selected&&s.selected]}><Text style={s.pillText}>{text??label}</Text></Pressable>; }
export function Field({label,secureTextEntry=false,style,...props}:TextInputProps & {label:string}) {
 const [revealed,setRevealed]=useState(false);
 useEffect(()=>{if(props.value==='')setRevealed(false);},[props.value]);
 return <View style={{gap:6}}>
  <Text style={s.label}>{label}</Text>
  <View style={secureTextEntry?{flexDirection:'row',alignItems:'center',gap:8}:undefined}>
   <TextInput {...props} accessibilityLabel={label} placeholderTextColor={palette.muted}
    secureTextEntry={secureTextEntry&&!revealed} style={[s.input,secureTextEntry&&{flex:1,minWidth:0},style]}/>
   {secureTextEntry&&<IconButton icon={revealed?'eye-off':'eye'} label={`${revealed?'Ocultar':'Mostrar'}: ${label}`}
    onPress={()=>setRevealed(value=>!value)}/>}
  </View>
 </View>;
}
