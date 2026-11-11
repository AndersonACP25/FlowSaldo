import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '@flowsaldo/database';
import { categoryName,categoryKey,type Category } from '@flowsaldo/domain';
import { z } from 'zod';
export class CategoryError extends Error { constructor(message:string,public status=400){super(message);} }
const schema=z.object({name:z.string().transform((v,ctx)=>{try{return categoryName(v);}catch{ctx.addIssue({code:'custom',message:'Nombre inválido'});return z.NEVER;}})});
export const categoryRoutes=Router();
categoryRoutes.get('/categories',async(_req,res)=>res.json(await db.category.findMany({orderBy:[{archived:'asc'},{name:'asc'}]})));
categoryRoutes.post('/categories',async(req,res)=>{
 const {name}=schema.parse(req.body);
 res.status(201).json(await db.category.create({data:{name,normalizedName:categoryKey(name)}}));
});
categoryRoutes.patch('/categories/:id',async(req,res)=>{
 const patch=schema.partial().extend({archived:z.boolean().optional()}).refine(v=>v.name!==undefined||v.archived!==undefined).parse(req.body);
 const item=await db.$transaction(async tx=>{
  const [existing]=await tx.$queryRaw<Category[]>`SELECT * FROM "Category" WHERE id=${req.params.id} FOR UPDATE`;
  if(!existing)throw new CategoryError('Categoría no encontrada.',404);
  if(existing.system)throw new CategoryError('Sin categorizar es una categoría del sistema.',409);
  return tx.category.update({where:{id:existing.id},data:{...patch,...(patch.name?{normalizedName:categoryKey(patch.name)}:{})}});
 });
 res.json(item);
});
// Share-lock serializes assignments against archive/rename, inside the movement transaction.
export async function assignCategory(tx:Prisma.TransactionClient,data:{category:string;categoryId?:string|null},previous?:{categoryId:string|null;category:string}|null) {
 const [category]=data.categoryId
  ?await tx.$queryRaw<Category[]>`SELECT * FROM "Category" WHERE id=${data.categoryId} FOR SHARE`
  :await tx.$queryRaw<Category[]>`SELECT * FROM "Category" WHERE "normalizedName"=${categoryKey(data.category)} FOR SHARE`;
 if(!category)throw new CategoryError('Selecciona una categoría existente.');
 if(category.archived&&previous?.categoryId!==category.id)throw new CategoryError('La categoría está archivada. Selecciona una activa.',409);
 return {categoryId:category.id,category:previous?.categoryId===category.id?previous.category:category.name};
}
