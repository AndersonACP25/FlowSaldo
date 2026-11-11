import type { Movement } from './index.ts';
export interface Category { id:string;name:string;normalizedName:string;archived:boolean;system:boolean }
export const defaultCategoryNames=['Sin categorizar','Alimentación','Transporte','Servicios','Salario','Ocio','Transferencias'];
export function categoryName(value:string):string {
 const name=value.trim().replace(/\s+/g,' ');
 if(!name||name.length>60)throw new Error('La categoría debe tener entre 1 y 60 caracteres.');
 return name;
}
export const categoryKey=(value:string)=>categoryName(value).toLocaleLowerCase('es');
export function demoCategoryCatalog(rows:Movement[]):Category[] {
 return [...new Set([...defaultCategoryNames,...rows.map(m=>m.category)].map(categoryKey))].map(key=>({id:`local-category:${key}`,name:[...defaultCategoryNames,...rows.map(m=>m.category)].find(n=>categoryKey(n)===key)!,normalizedName:key,archived:false,system:key==='sin categorizar'}));
}
export function selectedCategory(catalog:Category[],id:string|undefined,name:string,previous?:Movement) {
 const category=id?catalog.find(c=>c.id===id):catalog.find(c=>c.normalizedName===categoryKey(name));
 if(!category)throw new Error('Selecciona una categoría existente.');
 if(category.archived&&previous?.categoryId!==category.id)throw new Error('La categoría está archivada. Selecciona una activa.');
 return {categoryId:category.id,category:previous?.categoryId===category.id?previous.category:category.name};
}
export function budgetStatus(spent:number,limit:number) {
 if(!Number.isSafeInteger(spent)||spent<0||!Number.isSafeInteger(limit)||limit<=0||limit>2147483647)throw new Error('Presupuesto o gasto inválido.');
 const state=spent>=limit?'exceeded':BigInt(spent)*5n>=BigInt(limit)*4n?'warning':'normal';
 return {state,percentage:Math.round(spent/limit*100),availableMinor:Math.max(0,limit-spent),excessMinor:Math.max(0,spent-limit)};
}
export function movementDate(month:string,today:string):string {
 if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Mes inválido');
 return today.startsWith(month)?today:month+'-01';
}
export function upgradeCategories(movements:Movement[],stored?:Category[]) {
 const categories=stored??demoCategoryCatalog(movements);
 if(!Array.isArray(categories)||categories.some(c=>!c||typeof c.id!=='string'||!c.id||typeof c.archived!=='boolean'||typeof c.system!=='boolean'||categoryKey(c.name)!==c.normalizedName)||new Set(categories.map(c=>c.id)).size!==categories.length||new Set(categories.map(c=>c.normalizedName)).size!==categories.length||!categories.some(c=>c.system&&c.normalizedName==='sin categorizar'&&!c.archived))throw new Error('Catálogo local inválido');
 const upgraded=movements.map(m=>{
  const category=m.categoryId?categories.find(c=>c.id===m.categoryId):categories.find(c=>c.normalizedName===categoryKey(m.category));
  if(!category)throw new Error('Categoría del movimiento no encontrada');
  return {...m,categoryId:category.id};
 });
 return {movements:upgraded,categories};
}
