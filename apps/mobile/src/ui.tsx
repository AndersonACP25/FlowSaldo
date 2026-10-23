import React from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { styles as s, palette } from './theme';
export function Button({label,onPress,disabled=false,text}:{label:string;onPress:()=>void;disabled?:boolean;text?:string}) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.button,disabled&&s.disabled]}><Text style={s.buttonText}>{text??label}</Text></Pressable>; }
export function Choice({label,selected,onPress,text}:{label:string;selected:boolean;onPress:()=>void;text?:string}) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={[s.pill,selected&&s.selected]}><Text style={s.pillText}>{text??label}</Text></Pressable>; }
export function Field({label,...props}:TextInputProps & {label:string}) { return <View style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} style={s.input} {...props}/></View>; }
