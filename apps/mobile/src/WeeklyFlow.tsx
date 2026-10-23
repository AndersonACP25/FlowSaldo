import React from 'react';
import { Text, View } from 'react-native';
import { dailyCashFlow, type Currency, type Movement } from '@flowsaldo/domain';
import { styles as s, palette } from './theme';
export function WeeklyFlow({rows,month,currency}:{rows:Movement[];month:string;currency:Currency}) {
 const today=new Date().toISOString().slice(0,10);
 const end=today.startsWith(month)?today:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).toISOString().slice(0,10);
 const days=dailyCashFlow(rows,end);const max=Math.max(1,...days.flatMap(d=>[d.incomeMinor,d.expenseMinor]));
 return <View style={s.card}><Text style={s.title}>Flujo de los últimos 7 días</Text><Text style={s.muted}>{days[0].day} — {end} · {currency}</Text><View style={{flexDirection:'row',height:140,gap:8,alignItems:'flex-end'}}>{days.map(day=><View key={day.day} accessibilityLabel={`${day.day}: ingreso ${(day.incomeMinor/100).toFixed(2)}, gasto ${(day.expenseMinor/100).toFixed(2)} ${currency}`} style={{flex:1,alignItems:'center',gap:8}}><View style={{height:110,flexDirection:'row',gap:3,alignItems:'flex-end'}}><View style={{width:10,height:day.incomeMinor?Math.max(3,day.incomeMinor/max*110):2,backgroundColor:day.incomeMinor?palette.primary:palette.soft,borderRadius:3}}/><View style={{width:10,height:day.expenseMinor?Math.max(3,day.expenseMinor/max*110):2,backgroundColor:day.expenseMinor?palette.cyan:palette.soft,borderRadius:3}}/></View><Text style={s.muted}>{day.day.slice(8)}</Text></View>)}</View><Text style={s.muted}>● Esmeralda: ingresos · ● Cian: gastos. Transferencias propias excluidas.</Text></View>;
}
