import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {type changeSince,type Currency} from '@flowsaldo/domain';
import {styles as s,palette} from './theme';

export interface Comparison {previousMonth:string;income:ReturnType<typeof changeSince>;expense:ReturnType<typeof changeSince>}

export function MonthlyComparison({comparison,money,currency,hideAmounts}:{comparison:Comparison;money:(value:number,currency:Currency)=>string;currency:Currency;hideAmounts:boolean}) {
 return <View style={s.card}>
  <Text style={s.title}>Comparación con el mes anterior</Text>
  <Text style={s.muted}>Frente a {comparison.previousMonth} · {currency}. El mes seleccionado puede estar en curso.</Text>
  <View style={styles.grid}>
   {(['income','expense'] as const).map(key=>{
    const value=comparison[key];
    const current=value.previousMinor+value.deltaMinor;
    const max=Math.max(current,value.previousMinor,1);
    const favorable=key==='income'?value.deltaMinor>0:value.deltaMinor<0;
    const tone=value.deltaMinor===0?palette.muted:favorable?palette.income:palette.expense;
    return <View key={key} style={styles.metric}>
     <View style={s.between}>
      <Text style={s.label}>{key==='income'?'Ingresos':'Gastos'}</Text>
      {!hideAmounts&&<Text style={[styles.change,{color:tone}]}>{value.percentage===null?'Sin base porcentual':`${value.percentage>0?'+':''}${value.percentage}%`}</Text>}
     </View>
     {([['Seleccionado',current,palette.primary],['Anterior',value.previousMinor,palette.muted]] as const).map(([label,amount,color])=><View key={label} style={styles.series}>
      <View style={s.between}><Text style={s.muted}>{label}</Text><Text style={s.text}>{money(amount,currency)}</Text></View>
      {!hideAmounts&&<View style={styles.track}><View style={{height:5,width:`${amount/max*100}%`,backgroundColor:color,borderRadius:5}}/></View>}
     </View>)}
    </View>;
   })}
  </View>
 </View>;
}
const styles=StyleSheet.create({
 grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
 metric:{flex:1,minWidth:220,padding:14,gap:10,borderRadius:14,backgroundColor:palette.raised},
 series:{gap:4},
 change:{fontSize:13,fontWeight:'700'},
 track:{height:5,borderRadius:5,backgroundColor:palette.soft},
});
