import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {validDate} from '@flowsaldo/domain';
import {IconButton} from './IconButton';
import {styles as s} from './theme';
import {Button, Choice, Field} from './ui';

export const localToday=()=>{
 const date=new Date();
 return [date.getFullYear(),date.getMonth()+1,date.getDate()].map(part=>String(part).padStart(2,'0')).join('-');
};

const monthLabel=new Intl.DateTimeFormat('es-DO',{month:'long',year:'numeric',timeZone:'UTC'});
const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const supported=(date:string)=>validDate(date)&&date>='1900-01-01'&&date<='9999-12-31';

export function PeriodPicker({date,onChange}:{date:string;onChange:(date:string)=>void}) {
 const [open,setOpen]=useState(false);
 const [year,setYear]=useState(date.slice(0,4));
 const [draft,setDraft]=useState(date);
 const yearValid=/^\d{4}$/.test(year)&&Number(year)>=1900;
 const month=date.slice(0,7);
 function select(value:string) {
  if(!supported(value))return;
  onChange(value);
  setOpen(false);
 }
 function stepWeek(delta:number) {
  const next=new Date(date+'T12:00:00Z');
  next.setUTCDate(next.getUTCDate()+delta*7);
  select(next.toISOString().slice(0,10));
 }
 return <View style={s.card}>
  <View style={s.between}>
   <View><Text style={s.label}>Resumen mensual</Text><Text style={styles.month}>{monthLabel.format(new Date(date+'T12:00:00Z'))}</Text></View>
   <IconButton icon="calendar" label={open?'Cerrar selector de período':'Elegir período'} onPress={()=>{
    setDraft(date);setYear(date.slice(0,4));setOpen(value=>!value);
   }}/>
  </View>
  <View style={s.row}>
   <Choice label="Semana anterior" text="‹ 7 días" selected={false} onPress={()=>stepWeek(-1)}/>
   <Text style={s.muted}>{date}</Text>
   <Choice label="Semana siguiente" text="7 días ›" selected={false} onPress={()=>stepWeek(1)}/>
   <Choice label="Volver a hoy" text="Hoy" selected={false} onPress={()=>select(localToday())}/>
  </View>
  {open&&<View style={styles.picker}>
   <Field label="Año" value={year} onChangeText={setYear} maxLength={4} keyboardType="number-pad"/>
   {yearValid?<View style={styles.months}>{months.map((name,index)=>{
    const value=year+'-'+String(index+1).padStart(2,'0');
    const end=new Date(value+'-01T12:00:00Z');
    end.setUTCMonth(end.getUTCMonth()+1,0);
    const today=localToday();
    return <View key={name} style={styles.cell}><Choice label={monthLabel.format(end)} text={name} selected={value===month} onPress={()=>select(today.startsWith(value)?today:end.toISOString().slice(0,10))}/></View>;
   })}</View>:<Text style={s.muted}>Introduce un año de cuatro dígitos desde 1900.</Text>}
   <Field label="Fecha exacta (AAAA-MM-DD)" value={draft} onChangeText={setDraft} maxLength={10}/>
   <Button label="Aplicar fecha" disabled={!supported(draft)} onPress={()=>select(draft)}/>
  </View>}
 </View>;
}

const styles=StyleSheet.create({
 month:{...s.title,textTransform:'capitalize'},
 picker:{gap:12},
 months:{flexDirection:'row',flexWrap:'wrap',gap:8},
 cell:{width:'23%',minWidth:56,maxWidth:112,flexGrow:1},
});
