import React, {useState} from 'react';
import {ActivityIndicator, Linking, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {parseAmount, validDate} from '@flowsaldo/domain';
import {fetchRates, rateCurrencies, type RateCurrency} from './Servicios/tasas';
import {localToday} from './PeriodPicker';
import {palette, styles as s} from './theme';
import {Button, Choice, Field} from './ui';

const rateFormat=new Intl.NumberFormat('es-DO',{maximumFractionDigits:6});
const pesos=new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',currencyDisplay:'code'});

export function RatesScreen() {
 const [draft,setDraft]=useState('');
 const [date,setDate]=useState('');
 const [amount,setAmount]=useState('');
 const [currency,setCurrency]=useState<RateCurrency>('USD');
 const rates=useQuery({
  queryKey:['exchange-rates',date],
  queryFn:({signal})=>fetchRates(date||undefined,signal),
  staleTime:60*60*1000,
  retry:false,
 });
 const rate=rates.data?.find(row=>row.base===currency)?.rate;
 let conversion:number|undefined;
 if(rate!==undefined&&amount.trim()){
  try {conversion=parseAmount(amount)/100*rate;}catch { /* Invalid input is described below. */ }
 }
 const canSearch=validDate(draft)&&draft<=localToday();
 return <>
  <View style={s.card}>
   <View style={s.between}>
    <Text style={s.title}>{date?`Tasas al ${date}`:'Últimas tasas publicadas'}</Text>
    <Button label="Actualizar tasas" text="Actualizar" disabled={rates.isFetching} onPress={()=>void rates.refetch()}/>
   </View>
   <Text style={s.muted}>Valores de referencia en pesos dominicanos por una unidad de USD o EUR.</Text>
   {rates.isFetching&&<ActivityIndicator color={palette.primary} accessibilityLabel="Consultando tasas"/>}
   {rates.isError&&<Text accessibilityRole="alert" style={s.error}>{rates.data?'No se pudieron actualizar. Se muestran los últimos datos de esta consulta.':'No se pudieron consultar las tasas. Verifica tu conexión o prueba otra fecha.'}</Text>}
   <View style={styles.grid}>
    {rates.data?.map(row=><View key={row.base} style={styles.rate}>
     <Text style={s.label}>{row.base} → DOP</Text>
     <Text style={s.heroValue}>{rateFormat.format(row.rate)}</Text>
     <Text style={s.muted}>Publicada el {row.date}</Text>
    </View>)}
   </View>
   <Choice label="Fuente: Frankfurter" text="Frankfurter ↗" selected={false} onPress={()=>void Linking.openURL('https://frankfurter.dev/es/').catch(()=>undefined)}/>
  </View>
  <View style={s.card}>
   <Text style={s.title}>Histórico</Text>
   <Field label="Fecha de la tasa (AAAA-MM-DD)" value={draft} onChangeText={setDraft} maxLength={10}/>
   <View style={s.row}>
    <Button label="Consultar fecha" disabled={!canSearch||draft===date} onPress={()=>setDate(draft)}/>
    <Choice label="Ver tasas recientes" text="Recientes" selected={!date} onPress={()=>{setDate('');setDraft('');}}/>
   </View>
  </View>
  <View style={s.card}>
   <Text style={s.title}>Conversión estimada a DOP</Text>
   <View style={s.row}>{rateCurrencies.map(unit=><Choice key={unit} label={unit} selected={unit===currency} onPress={()=>setCurrency(unit)}/>)}</View>
   <Field label={`Monto en ${currency}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={16}/>
   <Text accessibilityLiveRegion="polite" style={s.amount}>{conversion===undefined?'—':pesos.format(conversion)}</Text>
   {!!amount.trim()&&rate!==undefined&&conversion===undefined&&<Text style={s.error}>Escribe un monto positivo con hasta dos decimales y sin separadores de miles.</Text>}
   <Text style={s.muted}>La conversión es informativa. Los bancos pueden aplicar sus propias tasas y comisiones.</Text>
  </View>
 </>;
}

const styles=StyleSheet.create({
 grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
 rate:{flex:1,minWidth:185,backgroundColor:palette.raised,borderRadius:14,padding:16,gap:8},
});
