import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {validDate} from '@flowsaldo/domain';
import {Button,Choice,Field} from './ui';
import {styles as s} from './theme';
export function DatePicker({value,onChange}:{value:string;onChange:(date:string)=>void}) {
 const [open,setOpen]=useState(false);const [month,setMonth]=useState(value.slice(0,7));
 function move(delta:number){const [year,m]=month.split('-').map(Number);const d=new Date(Date.UTC(year,m-1+delta,1));setMonth(d.toISOString().slice(0,7));}
 const [year,m]=month.split('-').map(Number);const first=new Date(Date.UTC(year,m-1,1)).getUTCDay();const count=new Date(Date.UTC(year,m,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((first+count)/7)*7},(_,i)=>i-first+1);
 return <View style={{gap:8}}><Field label="Fecha (AAAA-MM-DD)" value={value} onChangeText={onChange} maxLength={10} placeholder="AAAA-MM-DD"/>
 <Button label={open?'Cerrar calendario':'Elegir fecha en calendario'} onPress={()=>{if(validDate(value))setMonth(value.slice(0,7));setOpen(!open);}}/>
 {open&&<View style={[s.banner,{gap:8}]}><View style={s.between}><Choice label="Calendario: mes anterior" text="‹" selected={false} onPress={()=>move(-1)}/><Text style={s.text}>{month}</Text><Choice label="Calendario: mes siguiente" text="›" selected={false} onPress={()=>move(1)}/></View>
 <View style={{flexDirection:'row'}}>{['D','L','M','X','J','V','S'].map((day,i)=><Text key={i} style={[s.muted,{flex:1,textAlign:'center'}]}>{day}</Text>)}</View>
 {Array.from({length:cells.length/7},(_,week)=><View key={week} style={{flexDirection:'row',gap:2}}>{cells.slice(week*7,week*7+7).map((day,i)=>{const date=month+'-'+String(day).padStart(2,'0');return <View key={i} style={{flex:1,minWidth:0}}>{day>0&&day<=count&&<Choice compact label={`Elegir ${date}`} text={String(day)} selected={value===date} onPress={()=>{onChange(date);setOpen(false);}}/>}</View>;})}</View>)}
 </View>}
 </View>;
}
