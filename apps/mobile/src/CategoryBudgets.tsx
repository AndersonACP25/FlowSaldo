import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {budgetStatus,parseAmount,type Category,type Currency} from '@flowsaldo/domain';
import {Button,Choice,Field} from './ui';
import {styles as s,palette} from './theme';
export function BudgetProgress({spent,limit,money,currency}:{spent:number;limit:number;money:(minor:number,currency:Currency)=>string;currency:Currency}) {
 const status=budgetStatus(spent,limit);const color=status.state==='exceeded'?palette.expense:status.state==='warning'?palette.amber:palette.primary;
 return <View style={{gap:8}}><Text style={[s.text,{color}]}>{status.percentage}% utilizado · {money(limit,currency)}</Text><View accessibilityLabel={`${status.percentage}% del presupuesto utilizado`} style={s.track}><View style={[s.fill,{width:`${Math.min(100,status.percentage)}%`,backgroundColor:color}]}/></View>
 <Text style={s.muted}>Gastado: {money(spent,currency)} · {status.excessMinor?'Exceso: '+money(status.excessMinor,currency):'Disponible: '+money(status.availableMinor,currency)}</Text>
 {status.state!=='normal'&&<Text accessibilityLiveRegion="polite" style={{color}}>{status.state==='exceeded'?'Límite alcanzado o superado (100 %).':'Atención: has utilizado al menos el 80 %.'}</Text>}</View>;
}
export function CategoryBudgets({items,budgets,expenses,onSave,money,currency}:{items:Category[];budgets:Record<string,number>;expenses:Array<{categoryId:string|null;amountMinor:number}>;onSave:(id:string,value:number|null)=>Promise<void>;money:(minor:number,currency:Currency)=>string;currency:Currency}) {
 const [selected,setSelected]=useState('');const [input,setInput]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 async function run(id:string,value:number|null){setBusy(true);setError('');setNotice('');try{await onSave(id,value);setInput('');setNotice(value===null?'Límite por categoría eliminado.':'Presupuesto por categoría guardado.');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}}
 return <View style={s.card}><Text style={s.title}>Presupuestos por categoría</Text><Text style={s.muted}>Límites independientes del presupuesto general, guardados en este dispositivo para el mes, moneda y modo seleccionados.</Text>
 <View style={s.row}>{items.filter(c=>!c.archived).map(c=><Choice key={c.id} label={`Presupuesto: ${c.name}`} text={c.name} selected={selected===c.id} onPress={()=>{setSelected(c.id);setInput(budgets[c.id]?String(budgets[c.id]/100):'');}}/>)}</View>
 <Field label="Límite por categoría" value={input} onChangeText={setInput} keyboardType="decimal-pad" placeholder="Ejemplo: 5000"/>
 <Button label="Guardar límite por categoría" disabled={busy||!selected} onPress={()=>{try{void run(selected,parseAmount(input));}catch(e){setError(e instanceof Error?e.message:'Monto inválido');}}}/>
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
 {items.filter(c=>!!budgets[c.id]).map(c=><View key={c.id} style={{gap:10}}><Text style={s.text}>{c.name}{c.archived?' · Archivada':''}</Text><BudgetProgress spent={expenses.find(v=>v.categoryId===c.id)?.amountMinor??0} limit={budgets[c.id]} money={money} currency={currency}/><Button label={`Quitar límite de ${c.name}`} disabled={busy} onPress={()=>void run(c.id,null)}/></View>)}
 </View>;
}
