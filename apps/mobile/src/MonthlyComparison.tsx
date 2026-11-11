import React from 'react';
import {Text,View} from 'react-native';
import {type changeSince,type Currency} from '@flowsaldo/domain';
import {styles as s,palette} from './theme';
export interface Comparison {previousMonth:string;income:ReturnType<typeof changeSince>;expense:ReturnType<typeof changeSince>}
export function MonthlyComparison({comparison,money,currency}:{comparison:Comparison;money:(value:number,currency:Currency)=>string;currency:Currency}) {
 return <View style={s.card}><Text style={s.title}>Comparación con el mes anterior</Text><Text style={s.muted}>Frente a {comparison.previousMonth}, en {currency}. Totales registrados de cada mes; el mes actual puede estar en curso.</Text>
 {(['income','expense'] as const).map(key=>{const value=comparison[key];const favorable=key==='income'?value.deltaMinor>=0:value.deltaMinor<=0;return <View key={key} style={{gap:6}}><Text style={s.text}>{key==='income'?'Ingresos':'Gastos'} · Mes anterior: {money(value.previousMinor,currency)}</Text><Text style={{color:favorable?palette.income:palette.expense}}>Variación: {value.deltaMinor>0?'+':''}{money(value.deltaMinor,currency)} · {value.percentage===null?'Sin base de comparación':`${value.percentage>0?'+':''}${value.percentage}%`}</Text></View>;})}
 <Text style={s.muted}>Una base anterior de cero no permite calcular un porcentaje de aumento.</Text></View>;
}
