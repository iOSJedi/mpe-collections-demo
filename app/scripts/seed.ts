/**
 * Synthetic data seed script for Citimart Trade Promotion Optimization
 *
 * Generates authentic Filipino grocery chain demo data for a POC
 * targeting a grocery chain in Batangas, Philippines.
 *
 * Usage: cd app && npx tsx scripts/seed.ts
 *
 * Uses raw postgres.js for performance (NOT Drizzle ORM).
 * All randomness is seeded for reproducibility.
 */

import 'dotenv/config'
import postgres from 'postgres'

// ─── Seeded PRNG (Mulberry32) ───────────────────────────────────
let _seed = 42
function rand(): number {
  _seed |= 0
  _seed = (_seed + 0x6d2b79f5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Helpers ────────────────────────────────────────────────────
function pad(n: number, len: number): string {
  return String(n).padStart(len, '0')
}
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function fmtTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// ─── 1. BRANCHES ────────────────────────────────────────────────
const BRANCHES = [
  { branch_id: 'BAYMALL', branch_name: 'Citimart Baymall', address: 'Rizal Ave cor P. Burgos St, Batangas City', municipality: 'Batangas City', province: 'Batangas', opening_date: '1986-06-06', floor_area_sqm: 2500 },
  { branch_id: 'PLAZA', branch_name: 'Citimart Plaza', address: 'P. Burgos St, Batangas City', municipality: 'Batangas City', province: 'Batangas', opening_date: '1992-03-15', floor_area_sqm: 2000 },
  { branch_id: 'SHOPON', branch_name: 'Citimart Shop-On', address: 'Kumintang Ibaba, Batangas City', municipality: 'Batangas City', province: 'Batangas', opening_date: '2005-11-20', floor_area_sqm: 1800 },
  { branch_id: 'BAUAN', branch_name: 'Citimart Bauan', address: 'National Highway, Poblacion, Bauan', municipality: 'Bauan', province: 'Batangas', opening_date: '1998-07-10', floor_area_sqm: 1500 },
  { branch_id: 'LEMERY', branch_name: 'Citimart Lemery', address: 'Illustre Ave, Poblacion, Lemery', municipality: 'Lemery', province: 'Batangas', opening_date: '2010-01-22', floor_area_sqm: 1600 },
  { branch_id: 'TANAUAN', branch_name: 'Citimart Tanauan', address: 'JP Laurel Highway, Tanauan', municipality: 'Tanauan', province: 'Batangas', opening_date: '2015-08-08', floor_area_sqm: 2200 },
  { branch_id: 'CALAPAN', branch_name: 'Citimart Island Mall', address: 'J.P. Rizal St, Calapan City', municipality: 'Calapan City', province: 'Oriental Mindoro', opening_date: '2008-04-05', floor_area_sqm: 1400 },
]

const BRANCH_IDS = BRANCHES.map((b) => b.branch_id)
const BATANGAS_BRANCH_IDS = BRANCH_IDS.filter((b) => b !== 'CALAPAN')

// ─── 2. PRODUCTS ────────────────────────────────────────────────
interface Product {
  product_id: string
  product_name: string
  brand: string
  category: string
  subcategory: string
  department: string
  retail_price: number
  wholesale_price: number
  supplier: string
}

let skuCounter = 0
function sku(): string {
  skuCounter++
  return `SKU${pad(skuCounter, 4)}`
}
function wp(retail: number, discountPct?: number): number {
  const disc = discountPct ?? 8 + rand() * 7 // 8-15%
  return Math.round(retail * (1 - disc / 100) * 100) / 100
}

const PRODUCTS: Product[] = []

function addProducts(
  dept: string,
  cat: string,
  subcat: string,
  items: { name: string; brand: string; price: number; supplier?: string }[],
) {
  for (const item of items) {
    PRODUCTS.push({
      product_id: sku(),
      product_name: item.name,
      brand: item.brand,
      category: cat,
      subcategory: subcat,
      department: dept,
      retail_price: item.price,
      wholesale_price: wp(item.price),
      supplier: item.supplier ?? item.brand,
    })
  }
}

// FOOD - Instant Noodles
addProducts('Food', 'Instant Noodles', 'Pancit Canton', [
  { name: 'Lucky Me Pancit Canton Original', brand: 'Lucky Me', price: 12 },
  { name: 'Lucky Me Pancit Canton Kalamansi', brand: 'Lucky Me', price: 12 },
  { name: 'Lucky Me Pancit Canton Chilimansi', brand: 'Lucky Me', price: 12 },
  { name: 'Lucky Me Pancit Canton Extra Hot', brand: 'Lucky Me', price: 12 },
  { name: 'Lucky Me Pancit Canton Sweet & Spicy', brand: 'Lucky Me', price: 12 },
])
addProducts('Food', 'Instant Noodles', 'Instant Mami', [
  { name: 'Lucky Me Instant Mami Chicken', brand: 'Lucky Me', price: 10 },
  { name: 'Lucky Me Instant Mami Beef', brand: 'Lucky Me', price: 10 },
  { name: 'Lucky Me Instant Mami Bulalo', brand: 'Lucky Me', price: 10 },
  { name: 'Lucky Me La Paz Batchoy', brand: 'Lucky Me', price: 11 },
  { name: 'Payless Pancit Canton Original', brand: 'Payless', price: 7 },
  { name: 'Payless Pancit Canton Kalamansi', brand: 'Payless', price: 7 },
  { name: 'Quickchow Pancit Canton', brand: 'Quickchow', price: 6 },
  { name: 'Quickchow Instant Mami Chicken', brand: 'Quickchow', price: 6 },
  { name: 'Nissin Cup Noodles Seafood', brand: 'Nissin', price: 32 },
  { name: 'Nissin Cup Noodles Bulalo', brand: 'Nissin', price: 32 },
  { name: 'Nissin Yakisoba Classic', brand: 'Nissin', price: 15 },
])

// FOOD - Canned Goods
addProducts('Food', 'Canned Goods', 'Tuna', [
  { name: 'Century Tuna Flakes in Oil 155g', brand: 'Century', price: 32, supplier: 'Century Pacific Food' },
  { name: 'Century Tuna Flakes in Oil 420g', brand: 'Century', price: 82, supplier: 'Century Pacific Food' },
  { name: 'Century Tuna Mechado 155g', brand: 'Century', price: 34, supplier: 'Century Pacific Food' },
  { name: 'Century Tuna Caldereta 155g', brand: 'Century', price: 34, supplier: 'Century Pacific Food' },
  { name: 'Century Tuna Afritada 155g', brand: 'Century', price: 34, supplier: 'Century Pacific Food' },
  { name: 'Century Tuna Hot & Spicy 155g', brand: 'Century', price: 34, supplier: 'Century Pacific Food' },
])
addProducts('Food', 'Canned Goods', 'Corned Beef', [
  { name: 'Argentina Corned Beef 150g', brand: 'Argentina', price: 42, supplier: 'Century Pacific Food' },
  { name: 'Argentina Corned Beef 260g', brand: 'Argentina', price: 72, supplier: 'Century Pacific Food' },
  { name: 'Purefoods Corned Beef 150g', brand: 'Purefoods', price: 45, supplier: 'San Miguel Foods' },
  { name: 'Purefoods Corned Beef 260g', brand: 'Purefoods', price: 78, supplier: 'San Miguel Foods' },
  { name: 'CDO Corned Beef 150g', brand: 'CDO', price: 38, supplier: 'CDO Foodsphere' },
])
addProducts('Food', 'Canned Goods', 'Meat Loaf', [
  { name: 'Argentina Meat Loaf 150g', brand: 'Argentina', price: 28, supplier: 'Century Pacific Food' },
  { name: 'Argentina Meat Loaf 260g', brand: 'Argentina', price: 48, supplier: 'Century Pacific Food' },
  { name: 'CDO Liver Spread 85g', brand: 'CDO', price: 18, supplier: 'CDO Foodsphere' },
  { name: 'CDO Liver Spread 165g', brand: 'CDO', price: 32, supplier: 'CDO Foodsphere' },
])
addProducts('Food', 'Canned Goods', 'Sardines', [
  { name: 'Mega Sardines in Tomato Sauce 155g', brand: 'Mega', price: 18, supplier: 'Mega Global' },
  { name: 'Mega Sardines in Tomato Sauce 425g', brand: 'Mega', price: 45, supplier: 'Mega Global' },
  { name: 'Mega Sardines Spanish Style 155g', brand: 'Mega', price: 20, supplier: 'Mega Global' },
  { name: 'Ligo Sardines in Tomato Sauce 155g', brand: 'Ligo', price: 17, supplier: 'Ligo' },
  { name: 'Ligo Sardines in Tomato Sauce 425g', brand: 'Ligo', price: 42, supplier: 'Ligo' },
  { name: '555 Sardines in Tomato Sauce 155g', brand: '555', price: 18, supplier: '555 Sardines' },
  { name: '555 Fried Sardines 155g', brand: '555', price: 22, supplier: '555 Sardines' },
  { name: 'Young\'s Town Sardines 155g', brand: 'Young\'s Town', price: 16, supplier: 'Mega Global' },
])

// FOOD - Condiments
addProducts('Food', 'Condiments', 'Vinegar', [
  { name: 'Datu Puti Vinegar 385ml', brand: 'Datu Puti', price: 22, supplier: 'NutriAsia' },
  { name: 'Datu Puti Vinegar 1L', brand: 'Datu Puti', price: 48, supplier: 'NutriAsia' },
  { name: 'Datu Puti Spiced Vinegar 385ml', brand: 'Datu Puti', price: 28, supplier: 'NutriAsia' },
])
addProducts('Food', 'Condiments', 'Soy Sauce', [
  { name: 'Datu Puti Soy Sauce 385ml', brand: 'Datu Puti', price: 22, supplier: 'NutriAsia' },
  { name: 'Datu Puti Soy Sauce 1L', brand: 'Datu Puti', price: 48, supplier: 'NutriAsia' },
  { name: 'Silver Swan Soy Sauce 385ml', brand: 'Silver Swan', price: 20, supplier: 'NutriAsia' },
  { name: 'Silver Swan Soy Sauce 1L', brand: 'Silver Swan', price: 45, supplier: 'NutriAsia' },
])
addProducts('Food', 'Condiments', 'Ketchup & Sauce', [
  { name: 'UFC Banana Ketchup 320g', brand: 'UFC', price: 30, supplier: 'NutriAsia' },
  { name: 'UFC Banana Ketchup 550g', brand: 'UFC', price: 52, supplier: 'NutriAsia' },
  { name: 'Jufran Banana Ketchup 320g', brand: 'Jufran', price: 28, supplier: 'NutriAsia' },
  { name: 'Jufran Sweet Chili Sauce 330g', brand: 'Jufran', price: 35, supplier: 'NutriAsia' },
  { name: 'Mang Tomas All-Purpose Sauce Regular 330g', brand: 'Mang Tomas', price: 35, supplier: 'NutriAsia' },
  { name: 'Mang Tomas All-Purpose Sauce Hot 330g', brand: 'Mang Tomas', price: 35, supplier: 'NutriAsia' },
])
addProducts('Food', 'Condiments', 'Seasoning', [
  { name: 'Knorr Sinigang sa Sampalok Mix 22g', brand: 'Knorr', price: 12, supplier: 'Unilever' },
  { name: 'Knorr Sinigang sa Sampalok Mix 44g', brand: 'Knorr', price: 22, supplier: 'Unilever' },
  { name: 'Knorr Sinigang sa Gabi Mix 22g', brand: 'Knorr', price: 12, supplier: 'Unilever' },
  { name: 'Knorr Pork Cube 20g', brand: 'Knorr', price: 8, supplier: 'Unilever' },
  { name: 'Knorr Chicken Cube 20g', brand: 'Knorr', price: 8, supplier: 'Unilever' },
  { name: 'Maggi Magic Sarap 8g x12', brand: 'Maggi', price: 42, supplier: 'Nestle' },
  { name: 'Maggi Magic Sarap 50g', brand: 'Maggi', price: 18, supplier: 'Nestle' },
  { name: 'AJI-NO-MOTO Umami Seasoning 100g', brand: 'Ajinomoto', price: 25, supplier: 'Ajinomoto PH' },
  { name: 'AJI-NO-MOTO Umami Seasoning 250g', brand: 'Ajinomoto', price: 55, supplier: 'Ajinomoto PH' },
])

// FOOD - Rice & Cooking
addProducts('Food', 'Rice & Grains', 'Rice', [
  { name: 'Well-Milled Rice 5kg', brand: 'Local', price: 280, supplier: 'NFA / Local Mills' },
  { name: 'Well-Milled Rice 10kg', brand: 'Local', price: 540, supplier: 'NFA / Local Mills' },
  { name: 'Well-Milled Rice 25kg', brand: 'Local', price: 1300, supplier: 'NFA / Local Mills' },
  { name: 'Premium Jasmine Rice 5kg', brand: 'Local', price: 350, supplier: 'NFA / Local Mills' },
  { name: 'Sinandomeng Rice 5kg', brand: 'Local', price: 290, supplier: 'NFA / Local Mills' },
  { name: 'Dinorado Rice 5kg', brand: 'Local', price: 320, supplier: 'NFA / Local Mills' },
])
addProducts('Food', 'Cooking Oil', 'Cooking Oil', [
  { name: 'Minola Coconut Oil 485ml', brand: 'Minola', price: 85, supplier: 'Liberty Flour Mills' },
  { name: 'Minola Coconut Oil 950ml', brand: 'Minola', price: 155, supplier: 'Liberty Flour Mills' },
  { name: 'Golden Fiesta Palm Oil 485ml', brand: 'Golden Fiesta', price: 70, supplier: 'NutriAsia' },
  { name: 'Golden Fiesta Palm Oil 950ml', brand: 'Golden Fiesta', price: 125, supplier: 'NutriAsia' },
  { name: 'Baguio Oil 485ml', brand: 'Baguio', price: 80, supplier: 'Baguio Oil' },
  { name: 'Baguio Oil 950ml', brand: 'Baguio', price: 145, supplier: 'Baguio Oil' },
])

// FOOD - Snacks
addProducts('Food', 'Snacks', 'Chips', [
  { name: 'Oishi Prawn Crackers Original 60g', brand: 'Oishi', price: 22, supplier: 'Liwayway Marketing' },
  { name: 'Oishi Prawn Crackers Spicy 60g', brand: 'Oishi', price: 22, supplier: 'Liwayway Marketing' },
  { name: 'Piattos Cheese 85g', brand: 'Piattos', price: 28, supplier: 'Jack n Jill' },
  { name: 'Piattos Roadhouse BBQ 85g', brand: 'Piattos', price: 28, supplier: 'Jack n Jill' },
  { name: 'Chippy BBQ 110g', brand: 'Chippy', price: 25, supplier: 'Jack n Jill' },
  { name: 'Chippy Garlic & Vinegar 110g', brand: 'Chippy', price: 25, supplier: 'Jack n Jill' },
  { name: 'Nova Cheddar Cheese 78g', brand: 'Nova', price: 22, supplier: 'Jack n Jill' },
  { name: 'Nova Homestyle BBQ 78g', brand: 'Nova', price: 22, supplier: 'Jack n Jill' },
  { name: 'V-Cut Great Original 60g', brand: 'V-Cut', price: 18, supplier: 'Jack n Jill' },
  { name: 'Clover Chips Cheese 85g', brand: 'Leslies', price: 25, supplier: 'Leslies' },
])
addProducts('Food', 'Snacks', 'Crackers & Biscuits', [
  { name: 'SkyFlakes Crackers 250g', brand: 'SkyFlakes', price: 35, supplier: 'M.Y. San' },
  { name: 'SkyFlakes Crackers 25g x10', brand: 'SkyFlakes', price: 50, supplier: 'M.Y. San' },
  { name: 'Fita Crackers 30g x10', brand: 'Fita', price: 48, supplier: 'M.Y. San' },
  { name: 'Rebisco Crackers 33g x10', brand: 'Rebisco', price: 42, supplier: 'Rebisco' },
  { name: 'Rebisco Sandwich 32g x10', brand: 'Rebisco', price: 45, supplier: 'Rebisco' },
  { name: 'Hi-Ho Biscuit 200g', brand: 'Hi-Ho', price: 30, supplier: 'Monde Nissin' },
  { name: 'Cream-O Chocolate 33g x10', brand: 'Cream-O', price: 48, supplier: 'Jack n Jill' },
  { name: 'Cream-O Vanilla 33g x10', brand: 'Cream-O', price: 48, supplier: 'Jack n Jill' },
  { name: 'Hansel Sandwich Chocolate 31g x10', brand: 'Hansel', price: 42, supplier: 'Rebisco' },
  { name: 'Oreo Original 133g', brand: 'Oreo', price: 45, supplier: 'Mondelez' },
])

// FOOD - Noodles/Pasta
addProducts('Food', 'Noodles', 'Dried Noodles', [
  { name: 'UFC Golden Bihon 227g', brand: 'UFC', price: 22, supplier: 'NutriAsia' },
  { name: 'Royal Pasta Spaghetti 450g', brand: 'Royal', price: 38, supplier: 'Monde Nissin' },
  { name: 'Royal Pasta Elbow Macaroni 450g', brand: 'Royal', price: 38, supplier: 'Monde Nissin' },
  { name: 'Del Monte Spaghetti Sauce Filipino Style 500g', brand: 'Del Monte', price: 65, supplier: 'Del Monte PH' },
])

// FOOD - Bread & Spreads
addProducts('Food', 'Bread & Spreads', 'Bread', [
  { name: 'Gardenia Classic White 400g', brand: 'Gardenia', price: 55, supplier: 'Gardenia Bakeries' },
  { name: 'Gardenia High Fiber Wheat 400g', brand: 'Gardenia', price: 58, supplier: 'Gardenia Bakeries' },
  { name: 'Marby Pandesal 10pcs', brand: 'Marby', price: 42, supplier: 'Marby Food' },
])

// FOOD - Sugar & Milk (cooking)
addProducts('Food', 'Baking & Sugar', 'Sugar', [
  { name: 'White Sugar Refined 1kg', brand: 'Local', price: 60, supplier: 'Universal Robina' },
  { name: 'White Sugar Washed 1kg', brand: 'Local', price: 52, supplier: 'Universal Robina' },
  { name: 'Brown Sugar 1kg', brand: 'Local', price: 48, supplier: 'Universal Robina' },
])

// BEVERAGES - Coffee
addProducts('Beverages', 'Coffee', 'Instant Coffee', [
  { name: 'Nescafe Classic 100g', brand: 'Nescafe', price: 95, supplier: 'Nestle' },
  { name: 'Nescafe Classic 200g', brand: 'Nescafe', price: 175, supplier: 'Nestle' },
  { name: 'Nescafe 3in1 Original 28g x10', brand: 'Nescafe', price: 95, supplier: 'Nestle' },
  { name: 'Nescafe 3in1 Brown 28g x10', brand: 'Nescafe', price: 95, supplier: 'Nestle' },
  { name: 'Nescafe 3in1 Creamy White 26g x10', brand: 'Nescafe', price: 95, supplier: 'Nestle' },
  { name: 'Great Taste White 30g x10', brand: 'Great Taste', price: 88, supplier: 'Universal Robina' },
  { name: 'Great Taste White Caramel 30g x10', brand: 'Great Taste', price: 88, supplier: 'Universal Robina' },
  { name: 'Kopiko Brown Coffee 25g x10', brand: 'Kopiko', price: 80, supplier: 'Mayora Indah' },
  { name: 'Kopiko 78C Ready-to-Drink 240ml', brand: 'Kopiko', price: 25, supplier: 'Mayora Indah' },
  { name: 'San Mig Super Coffee Original 20g x10', brand: 'San Mig', price: 65, supplier: 'San Miguel' },
])

// BEVERAGES - Milk
addProducts('Beverages', 'Milk', 'Powdered Milk', [
  { name: 'Bear Brand Powdered Milk 300g', brand: 'Bear Brand', price: 85, supplier: 'Nestle' },
  { name: 'Bear Brand Powdered Milk 900g', brand: 'Bear Brand', price: 235, supplier: 'Nestle' },
  { name: 'Birch Tree Powdered Milk 300g', brand: 'Birch Tree', price: 78, supplier: 'Century Pacific Food' },
  { name: 'Birch Tree Powdered Milk 700g', brand: 'Birch Tree', price: 168, supplier: 'Century Pacific Food' },
  { name: 'Alaska Powdered Milk 300g', brand: 'Alaska', price: 82, supplier: 'Alaska Milk Corp' },
  { name: 'Nido Powdered Milk 400g', brand: 'Nido', price: 125, supplier: 'Nestle' },
])
addProducts('Beverages', 'Milk', 'Liquid Milk', [
  { name: 'Bear Brand Sterilized 200ml', brand: 'Bear Brand', price: 22, supplier: 'Nestle' },
  { name: 'Alaska Evaporada 370ml', brand: 'Alaska', price: 32, supplier: 'Alaska Milk Corp' },
  { name: 'Alaska Condensada 300ml', brand: 'Alaska', price: 38, supplier: 'Alaska Milk Corp' },
  { name: 'Alaska Condensada 168ml', brand: 'Alaska', price: 22, supplier: 'Alaska Milk Corp' },
  { name: 'Angel Evaporada 370ml', brand: 'Angel', price: 30, supplier: 'Alaska Milk Corp' },
])

// BEVERAGES - Juice & Soft Drinks
addProducts('Beverages', 'Juice & Tea', 'Juice', [
  { name: 'C2 Green Tea Apple 500ml', brand: 'C2', price: 20, supplier: 'Universal Robina' },
  { name: 'C2 Green Tea Original 500ml', brand: 'C2', price: 20, supplier: 'Universal Robina' },
  { name: 'C2 Green Tea Lemon 500ml', brand: 'C2', price: 20, supplier: 'Universal Robina' },
  { name: 'Zest-O Orange Juice 200ml x10', brand: 'Zest-O', price: 85, supplier: 'Zest-O Corp' },
  { name: 'Zest-O Calamansi 200ml x10', brand: 'Zest-O', price: 85, supplier: 'Zest-O Corp' },
  { name: 'Tang Orange 25g x12', brand: 'Tang', price: 72, supplier: 'Mondelez' },
  { name: 'Eight OClock Juice Apple 250ml', brand: 'Eight OClock', price: 12, supplier: 'Mega Global' },
])
addProducts('Beverages', 'Soft Drinks', 'Carbonated', [
  { name: 'Coca-Cola Mismo 295ml', brand: 'Coca-Cola', price: 15, supplier: 'Coca-Cola PH' },
  { name: 'Coca-Cola 1.5L', brand: 'Coca-Cola', price: 65, supplier: 'Coca-Cola PH' },
  { name: 'Coca-Cola 2L', brand: 'Coca-Cola', price: 78, supplier: 'Coca-Cola PH' },
  { name: 'Royal Tru-Orange Mismo 295ml', brand: 'Royal', price: 15, supplier: 'Coca-Cola PH' },
  { name: 'Royal Tru-Orange 1.5L', brand: 'Royal', price: 65, supplier: 'Coca-Cola PH' },
  { name: 'Sprite Mismo 295ml', brand: 'Sprite', price: 15, supplier: 'Coca-Cola PH' },
  { name: 'Sprite 1.5L', brand: 'Sprite', price: 65, supplier: 'Coca-Cola PH' },
  { name: 'Mountain Dew Mismo 295ml', brand: 'Mountain Dew', price: 15, supplier: 'PepsiCo PH' },
  { name: 'Mountain Dew 1.5L', brand: 'Mountain Dew', price: 65, supplier: 'PepsiCo PH' },
  { name: 'Pepsi Mismo 295ml', brand: 'Pepsi', price: 15, supplier: 'PepsiCo PH' },
])
addProducts('Beverages', 'Alcoholic', 'Beer', [
  { name: 'Red Horse Beer 500ml', brand: 'Red Horse', price: 42, supplier: 'San Miguel Brewery' },
  { name: 'Red Horse Beer 1L', brand: 'Red Horse', price: 72, supplier: 'San Miguel Brewery' },
  { name: 'San Miguel Pale Pilsen 330ml', brand: 'San Mig', price: 38, supplier: 'San Miguel Brewery' },
  { name: 'San Miguel Light 330ml', brand: 'San Mig', price: 38, supplier: 'San Miguel Brewery' },
  { name: 'San Miguel Super Dry 330ml', brand: 'San Mig', price: 42, supplier: 'San Miguel Brewery' },
])
addProducts('Beverages', 'Water', 'Purified Water', [
  { name: 'Absolute Purified Water 500ml', brand: 'Absolute', price: 12, supplier: 'Absolute Distillers' },
  { name: 'Absolute Purified Water 1L', brand: 'Absolute', price: 18, supplier: 'Absolute Distillers' },
  { name: 'Absolute Purified Water 6L', brand: 'Absolute', price: 55, supplier: 'Absolute Distillers' },
  { name: 'Nature\'s Spring Purified Water 500ml', brand: 'Nature\'s Spring', price: 12, supplier: 'Danone' },
  { name: 'Summit Natural Water 500ml', brand: 'Summit', price: 15, supplier: 'Summit Water' },
])

// PERSONAL CARE - Soap
addProducts('Personal Care', 'Soap', 'Bar Soap', [
  { name: 'Safeguard Pure White 130g', brand: 'Safeguard', price: 42, supplier: 'P&G' },
  { name: 'Safeguard Lemon Fresh 130g', brand: 'Safeguard', price: 42, supplier: 'P&G' },
  { name: 'Safeguard Floral Pink 130g', brand: 'Safeguard', price: 42, supplier: 'P&G' },
  { name: 'Palmolive Naturals White 115g', brand: 'Palmolive', price: 38, supplier: 'Colgate-Palmolive' },
  { name: 'Palmolive Naturals Milk & Rose 115g', brand: 'Palmolive', price: 38, supplier: 'Colgate-Palmolive' },
  { name: 'Dove White Beauty Bar 100g', brand: 'Dove', price: 55, supplier: 'Unilever' },
  { name: 'Dove Gentle Exfoliating 100g', brand: 'Dove', price: 55, supplier: 'Unilever' },
  { name: 'Bioderm Family Germicidal Green 135g', brand: 'Bioderm', price: 28, supplier: 'Lamoiyan Corp' },
  { name: 'Bioderm Family Germicidal Coolness 135g', brand: 'Bioderm', price: 28, supplier: 'Lamoiyan Corp' },
])

// PERSONAL CARE - Shampoo
addProducts('Personal Care', 'Shampoo', 'Shampoo', [
  { name: 'Head & Shoulders Cool Menthol 180ml', brand: 'Head & Shoulders', price: 125, supplier: 'P&G' },
  { name: 'Head & Shoulders Clean & Balanced 12ml x12', brand: 'Head & Shoulders', price: 48, supplier: 'P&G' },
  { name: 'Sunsilk Smooth & Manageable 180ml', brand: 'Sunsilk', price: 95, supplier: 'Unilever' },
  { name: 'Sunsilk Smooth & Manageable 12ml x12', brand: 'Sunsilk', price: 42, supplier: 'Unilever' },
  { name: 'Palmolive Naturals Shampoo 180ml', brand: 'Palmolive', price: 92, supplier: 'Colgate-Palmolive' },
  { name: 'Palmolive Naturals Shampoo 15ml x12', brand: 'Palmolive', price: 48, supplier: 'Colgate-Palmolive' },
  { name: 'Clear Ice Cool Menthol 180ml', brand: 'Clear', price: 120, supplier: 'Unilever' },
  { name: 'Clear Ice Cool Menthol 12ml x12', brand: 'Clear', price: 45, supplier: 'Unilever' },
  { name: 'Pantene Hair Fall Control 180ml', brand: 'Pantene', price: 130, supplier: 'P&G' },
  { name: 'Cream Silk Hair Fall Defense 12ml x12', brand: 'Cream Silk', price: 55, supplier: 'Unilever' },
])

// PERSONAL CARE - Toothpaste
addProducts('Personal Care', 'Oral Care', 'Toothpaste', [
  { name: 'Colgate Great Regular Flavor 74ml', brand: 'Colgate', price: 40, supplier: 'Colgate-Palmolive' },
  { name: 'Colgate Great Regular Flavor 150ml', brand: 'Colgate', price: 72, supplier: 'Colgate-Palmolive' },
  { name: 'Hapee Toothpaste Mint 100ml', brand: 'Hapee', price: 32, supplier: 'Lamoiyan Corp' },
  { name: 'Hapee Toothpaste Mint 200ml', brand: 'Hapee', price: 55, supplier: 'Lamoiyan Corp' },
  { name: 'Close-Up Red Hot 55ml', brand: 'Close-Up', price: 28, supplier: 'Unilever' },
  { name: 'Close-Up Menthol Fresh 55ml', brand: 'Close-Up', price: 28, supplier: 'Unilever' },
  { name: 'Colgate Toothbrush Extra Clean', brand: 'Colgate', price: 38, supplier: 'Colgate-Palmolive' },
])

// PERSONAL CARE - Deodorant
addProducts('Personal Care', 'Deodorant', 'Deodorant', [
  { name: 'Rexona Powder Dry 40ml', brand: 'Rexona', price: 85, supplier: 'Unilever' },
  { name: 'Rexona Shower Clean 6ml x6', brand: 'Rexona', price: 42, supplier: 'Unilever' },
  { name: 'Old Spice Whitewater 50ml', brand: 'Old Spice', price: 95, supplier: 'P&G' },
])

// HOUSEHOLD - Detergent
addProducts('Household', 'Laundry', 'Detergent Powder', [
  { name: 'Surf Powder Detergent Rose Fresh 1.1kg', brand: 'Surf', price: 120, supplier: 'Unilever' },
  { name: 'Surf Powder Detergent Rose Fresh 70g x6', brand: 'Surf', price: 48, supplier: 'Unilever' },
  { name: 'Tide Powder Detergent Original 1.2kg', brand: 'Tide', price: 135, supplier: 'P&G' },
  { name: 'Tide Powder Detergent Original 80g x6', brand: 'Tide', price: 55, supplier: 'P&G' },
  { name: 'Ariel Powder Detergent Sunrise Fresh 1.1kg', brand: 'Ariel', price: 140, supplier: 'P&G' },
  { name: 'Ariel Powder Detergent Sunrise Fresh 66g x6', brand: 'Ariel', price: 50, supplier: 'P&G' },
  { name: 'Smart Powder Detergent Clean Fresh 1kg', brand: 'Smart', price: 70, supplier: 'Peerless Products' },
  { name: 'Smart Powder Detergent Clean Fresh 70g x6', brand: 'Smart', price: 32, supplier: 'Peerless Products' },
  { name: 'Breeze Powder Detergent 680g', brand: 'Breeze', price: 85, supplier: 'Unilever' },
])
addProducts('Household', 'Laundry', 'Fabric Conditioner', [
  { name: 'Downy Garden Bloom 690ml', brand: 'Downy', price: 110, supplier: 'P&G' },
  { name: 'Downy Garden Bloom 28ml x6', brand: 'Downy', price: 42, supplier: 'P&G' },
  { name: 'Surf Fabric Conditioner Blossom Fresh 690ml', brand: 'Surf', price: 88, supplier: 'Unilever' },
  { name: 'Del Fabric Conditioner 900ml', brand: 'Del', price: 65, supplier: 'Del Industries' },
])

// HOUSEHOLD - Cleaning
addProducts('Household', 'Cleaning', 'Dishwashing', [
  { name: 'Joy Dishwashing Liquid Lemon 250ml', brand: 'Joy', price: 52, supplier: 'P&G' },
  { name: 'Joy Dishwashing Liquid Lemon 485ml', brand: 'Joy', price: 90, supplier: 'P&G' },
  { name: 'Joy Dishwashing Liquid Antibac 250ml', brand: 'Joy', price: 55, supplier: 'P&G' },
  { name: 'Smart Dishwashing Liquid 250ml', brand: 'Smart', price: 30, supplier: 'Peerless Products' },
])
addProducts('Household', 'Cleaning', 'Bleach & Disinfectant', [
  { name: 'Zonrox Bleach Original 500ml', brand: 'Zonrox', price: 30, supplier: 'Taisho Pharmaceuticals' },
  { name: 'Zonrox Bleach Original 1L', brand: 'Zonrox', price: 52, supplier: 'Taisho Pharmaceuticals' },
  { name: 'Domex Multi-Purpose Cleaner 500ml', brand: 'Domex', price: 65, supplier: 'Unilever' },
  { name: 'Mr. Muscle Kitchen Cleaner 500ml', brand: 'Mr. Muscle', price: 110, supplier: 'SC Johnson' },
  { name: 'Mr. Muscle Glass Cleaner 500ml', brand: 'Mr. Muscle', price: 95, supplier: 'SC Johnson' },
  { name: 'Lysol Disinfectant Spray 340g', brand: 'Lysol', price: 250, supplier: 'Reckitt' },
])

// HOUSEHOLD - Paper
addProducts('Household', 'Paper Products', 'Tissue', [
  { name: 'Tisyu Jumbo Tipid 2-Ply 4 Rolls', brand: 'Tisyu', price: 85, supplier: 'Sanicare' },
  { name: 'Tisyu Jumbo Tipid 2-Ply 12 Rolls', brand: 'Tisyu', price: 225, supplier: 'Sanicare' },
  { name: 'Scott Tissue Extra Care 2-Ply 4 Rolls', brand: 'Scott', price: 95, supplier: 'Kimberly-Clark' },
  { name: 'Sanicare Facial Tissue 200 Sheets', brand: 'Sanicare', price: 42, supplier: 'Sanicare' },
])
addProducts('Household', 'Paper Products', 'Feminine Care', [
  { name: 'Modess All Night Maxi 8s', brand: 'Modess', price: 45, supplier: 'J&J' },
  { name: 'Modess Regular Non-Wing 10s', brand: 'Modess', price: 38, supplier: 'J&J' },
  { name: 'Whisper All Night Wings 8s', brand: 'Whisper', price: 48, supplier: 'P&G' },
  { name: 'Jeunesse Anion Sanitary Napkin 10s', brand: 'Jeunesse', price: 42, supplier: 'Jeunesse' },
])

// HOUSEHOLD - Insecticide
addProducts('Household', 'Insecticide', 'Insecticide', [
  { name: 'Baygon Multi-Insect Killer 500ml', brand: 'Baygon', price: 180, supplier: 'SC Johnson' },
  { name: 'Baygon Mosquito Coil 10s', brand: 'Baygon', price: 45, supplier: 'SC Johnson' },
  { name: 'Off! Insect Repellent Lotion 50ml', brand: 'Off!', price: 55, supplier: 'SC Johnson' },
  { name: 'Katol Mosquito Coil 10s', brand: 'Katol', price: 18, supplier: 'Pascual Laboratories' },
])

// ─── Product ID lookups for pattern generation ─────────────────
function findProductId(nameFragment: string): string {
  const p = PRODUCTS.find((p) => p.product_name.toLowerCase().includes(nameFragment.toLowerCase()))
  if (!p) throw new Error(`Product not found: ${nameFragment}`)
  return p.product_id
}

// ─── 3. CUSTOMERS ───────────────────────────────────────────────
interface Customer {
  customer_id: string
  customer_type: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  loyalty_card_number: string | null
  wholesale_member_id: string | null
  business_name: string | null
  barangay: string
  municipality: string
  registration_date: string
  credit_limit: number | null
  credit_terms_days: number | null
  status: string
}

const FIRST_NAMES_M = ['Jose', 'Juan', 'Mark', 'Angelo', 'Carlo', 'Rafael', 'Miguel', 'Antonio', 'Danilo', 'Roberto', 'Eduardo', 'Ricardo', 'Federico', 'Ernesto', 'Ronaldo', 'Jayson', 'Bryan', 'Kevin', 'Aldrin', 'Rodel']
const FIRST_NAMES_F = ['Maria', 'Ana', 'Rosario', 'Lourdes', 'Angelica', 'Cherry', 'Josephine', 'Marites', 'Rowena', 'Marilyn', 'Gemma', 'Cristina', 'Nena', 'Ligaya', 'Remedios', 'Grace', 'Joy', 'Faith', 'Princess', 'Divine']
const LAST_NAMES = ['Reyes', 'Santos', 'Cruz', 'Garcia', 'Mendoza', 'Bautista', 'Del Rosario', 'Ramos', 'Villanueva', 'Gonzales', 'Manalo', 'Ilagan', 'Dimaculangan', 'Atienza', 'Marasigan', 'Perez', 'Lopez', 'Torres', 'Rivera', 'Hernandez', 'Aquino', 'Castillo', 'Mercado', 'De Leon', 'Pascual', 'Dimaano', 'Magpantay', 'Katigbak', 'Landicho', 'Cueto']

const BARANGAYS_BATANGAS = ['Kumintang Ibaba', 'Kumintang Ilaya', 'Bolbok', 'Pallocan', 'Alangilan', 'Cuta', 'Balagtas', 'Gulod Itaas', 'Poblacion', 'San Isidro']
const BARANGAYS_BAUAN = ['Poblacion', 'San Roque', 'Manghinao', 'Sinala', 'Balayong']
const BARANGAYS_LEMERY = ['Poblacion', 'Bagong Pook', 'Palanas', 'Mataas na Bayan', 'Igan']
const BARANGAYS_TANAUAN = ['Poblacion', 'Sambat', 'Gonzales', 'Natatas', 'Darasa']
const BARANGAYS_CALAPAN = ['Poblacion', 'Guinobatan', 'Ibaba East', 'Lalud', 'Parang']

const MUNICIPALITIES = [
  { name: 'Batangas City', barangays: BARANGAYS_BATANGAS, branches: ['BAYMALL', 'PLAZA', 'SHOPON'] },
  { name: 'Bauan', barangays: BARANGAYS_BAUAN, branches: ['BAUAN'] },
  { name: 'Lemery', barangays: BARANGAYS_LEMERY, branches: ['LEMERY'] },
  { name: 'Tanauan', barangays: BARANGAYS_TANAUAN, branches: ['TANAUAN'] },
  { name: 'Calapan City', barangays: BARANGAYS_CALAPAN, branches: ['CALAPAN'] },
]

const CUSTOMERS: Customer[] = []

function genPhone(): string {
  return `09${randInt(10, 99)}${randInt(100, 999)}${randInt(1000, 9999)}`
}

// Build shared phone pool for "both" type customers
const SHARED_PHONES: string[] = []
for (let i = 0; i < 18; i++) {
  SHARED_PHONES.push(genPhone())
}

let retailCounter = 0
let wholesaleCounter = 0

// Retail customers
for (let i = 0; i < 500; i++) {
  retailCounter++
  const isFemale = rand() > 0.45
  const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M)
  const lastName = pick(LAST_NAMES)
  const muni = pick(MUNICIPALITIES)
  const isShared = i < 18 // first 18 share phones with wholesale
  const phone = isShared ? SHARED_PHONES[i] : genPhone()

  // Registration date: random from 2022-2025
  const regDaysAgo = randInt(90, 1200)
  const regDate = addDays(new Date('2026-03-01'), -regDaysAgo)

  CUSTOMERS.push({
    customer_id: `LC-${pad(retailCounter, 5)}`,
    customer_type: 'retail',
    first_name: firstName,
    last_name: lastName,
    phone,
    email: rand() > 0.7 ? `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/ /g, '')}@gmail.com` : null,
    loyalty_card_number: `LC-${pad(retailCounter, 5)}`,
    wholesale_member_id: null,
    business_name: null,
    barangay: pick(muni.barangays),
    municipality: muni.name,
    registration_date: fmtDate(regDate),
    credit_limit: null,
    credit_terms_days: null,
    status: 'active',
  })
}

// Sari-sari store name patterns
const STORE_PATTERNS = [
  (fn: string, ln: string) => `${fn}'s Sari-Sari Store`,
  (_fn: string, ln: string) => `${ln} Tindahan`,
  (fn: string, ln: string) => `${fn} ${ln} General Merchandise`,
  (_fn: string, ln: string) => `${ln} Mini Mart`,
  (fn: string, _ln: string) => `Aling ${fn}'s Store`,
  (fn: string, _ln: string) => `Mang ${fn}'s Tindahan`,
  (_fn: string, ln: string) => `${ln} Trading`,
  (_fn: string, ln: string) => `${ln} Enterprises`,
]

// Wholesale customers
for (let i = 0; i < 80; i++) {
  wholesaleCounter++
  const isFemale = rand() > 0.5
  const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M)
  const lastName = pick(LAST_NAMES)
  const muni = pick(MUNICIPALITIES)
  const isShared = i < 18
  const phone = isShared ? SHARED_PHONES[i] : genPhone()

  const regDaysAgo = randInt(180, 1500)
  const regDate = addDays(new Date('2026-03-01'), -regDaysAgo)

  const creditLimit = pick([10000, 15000, 20000, 25000, 30000, 50000, 75000, 100000, 150000, 200000])
  const creditTerms = pick([7, 15, 30])
  const storeName = pick(STORE_PATTERNS)(firstName, lastName)

  CUSTOMERS.push({
    customer_id: `WM-${pad(wholesaleCounter, 5)}`,
    customer_type: 'wholesale',
    first_name: firstName,
    last_name: lastName,
    phone,
    email: rand() > 0.5 ? `${firstName.toLowerCase()}${lastName.toLowerCase().replace(/ /g, '')}@gmail.com` : null,
    loyalty_card_number: null,
    wholesale_member_id: `WM-${pad(wholesaleCounter, 5)}`,
    business_name: storeName,
    barangay: pick(muni.barangays),
    municipality: muni.name,
    registration_date: fmtDate(regDate),
    credit_limit: creditLimit,
    credit_terms_days: creditTerms,
    status: 'active',
  })
}

const RETAIL_IDS = CUSTOMERS.filter((c) => c.customer_type === 'retail').map((c) => c.customer_id)
const WHOLESALE_IDS = CUSTOMERS.filter((c) => c.customer_type === 'wholesale').map((c) => c.customer_id)

// ─── Special customer sets for embedded patterns ────────────────
// Pattern 4: 3-4 wholesale buyers in Lemery declining order frequency
const LEMERY_WHOLESALE = WHOLESALE_IDS.filter((id) => {
  const c = CUSTOMERS.find((c) => c.customer_id === id)
  return c && c.municipality === 'Lemery'
})
const DECLINING_LEMERY = LEMERY_WHOLESALE.slice(0, Math.min(4, LEMERY_WHOLESALE.length))

// Pattern 5: 2 wholesale buyers consistently overdue
const OVERDUE_WHOLESALE = WHOLESALE_IDS.slice(0, 2)

// Pattern 6: 1 wholesale buyer in Bauan increasing orders
const BAUAN_WHOLESALE = WHOLESALE_IDS.filter((id) => {
  const c = CUSTOMERS.find((c) => c.customer_id === id)
  return c && c.municipality === 'Bauan'
})
const GROWING_BAUAN = BAUAN_WHOLESALE.length > 0 ? BAUAN_WHOLESALE[0] : WHOLESALE_IDS[3]

// Pattern 10: retail loyalty customers who dropped frequency
const CHURNING_RETAIL = RETAIL_IDS.slice(0, 12) // 12 customers will drop from weekly to monthly

// Pattern: 1 wholesale buyer deteriorating payment behavior
const DETERIORATING_WHOLESALE = WHOLESALE_IDS[5]

// ─── 4. TRANSACTIONS ───────────────────────────────────────────
interface Transaction {
  transaction_id: string
  customer_id: string | null
  branch_id: string
  transaction_date: string
  transaction_type: string
  payment_method: string
  total_amount: number
  items_count: number
  loyalty_points_earned: number
}

interface TransactionItem {
  transaction_id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  is_wholesale_price: boolean
}

const START_DATE = new Date('2025-09-01')
const END_DATE = new Date('2026-03-01')
const TOTAL_DAYS = daysBetween(START_DATE, END_DATE) // 182 days

const TRANSACTIONS: Transaction[] = []
const TRANSACTION_ITEMS: TransactionItem[] = []

let txnCounter = 0

function genTxnId(branchId: string, date: Date): string {
  txnCounter++
  return `${branchId}-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${pad(txnCounter, 6)}`
}

// Products by department for weighted selection
const FOOD_PRODUCTS = PRODUCTS.filter((p) => p.department === 'Food')
const BEVERAGE_PRODUCTS = PRODUCTS.filter((p) => p.department === 'Beverages')
const PERSONAL_CARE_PRODUCTS = PRODUCTS.filter((p) => p.department === 'Personal Care')
const HOUSEHOLD_PRODUCTS = PRODUCTS.filter((p) => p.department === 'Household')

// Key product IDs for patterns
const PANCIT_CANTON_IDS = PRODUCTS.filter((p) => p.product_name.includes('Pancit Canton') && p.brand === 'Lucky Me').map((p) => p.product_id)
const CENTURY_TUNA_IDS = PRODUCTS.filter((p) => p.brand === 'Century').map((p) => p.product_id)
const NESCAFE_3IN1_IDS = PRODUCTS.filter((p) => p.product_name.includes('Nescafe 3in1')).map((p) => p.product_id)
const REBISCO_IDS = PRODUCTS.filter((p) => p.brand === 'Rebisco').map((p) => p.product_id)
const BEER_IDS = PRODUCTS.filter((p) => p.category === 'Alcoholic').map((p) => p.product_id)
const SOFTDRINK_IDS = PRODUCTS.filter((p) => p.category === 'Soft Drinks').map((p) => p.product_id)
const WATER_IDS = PRODUCTS.filter((p) => p.category === 'Water').map((p) => p.product_id)
const JUICE_IDS = PRODUCTS.filter((p) => p.category === 'Juice & Tea').map((p) => p.product_id)

// For Calapan pattern (different top categories - more household/personal care, fewer beverages)
const CALAPAN_HEAVY_PRODUCTS = [...HOUSEHOLD_PRODUCTS, ...PERSONAL_CARE_PRODUCTS, ...FOOD_PRODUCTS.filter((p) => p.category === 'Canned Goods' || p.category === 'Rice & Grains')]

function pickProductsForRetailBasket(branchId: string, hour: number, dayOfWeek: number): { product: Product; qty: number }[] {
  const items: { product: Product; qty: number }[] = []
  const numItems = randInt(2, 5)

  // Pattern 2: Morning coffee + crackers co-occurrence
  const isMorning = hour >= 6 && hour <= 10
  if (isMorning && rand() > 0.55) {
    // High co-occurrence of coffee + crackers in morning
    const coffeeId = pick(NESCAFE_3IN1_IDS)
    const coffeeProduct = PRODUCTS.find((p) => p.product_id === coffeeId)!
    items.push({ product: coffeeProduct, qty: randInt(1, 3) })

    if (rand() > 0.3) {
      const crackerId = pick(REBISCO_IDS)
      const crackerProduct = PRODUCTS.find((p) => p.product_id === crackerId)!
      items.push({ product: crackerProduct, qty: randInt(1, 2) })
    }
  }

  // Pattern 3: Tanauan higher beverage proportion
  const isTanauan = branchId === 'TANAUAN'

  // Pattern 7: Calapan different top categories
  const isCalapan = branchId === 'CALAPAN'

  const remaining = numItems - items.length
  for (let i = 0; i < remaining; i++) {
    let pool: Product[]
    if (isCalapan) {
      // Calapan: heavier on household and personal care, lighter on beverages
      pool = pickWeighted(
        [FOOD_PRODUCTS, BEVERAGE_PRODUCTS, PERSONAL_CARE_PRODUCTS, HOUSEHOLD_PRODUCTS],
        [30, 10, 30, 30],
      )
    } else if (isTanauan) {
      // Tanauan: significantly higher beverage sales
      pool = pickWeighted(
        [FOOD_PRODUCTS, BEVERAGE_PRODUCTS, PERSONAL_CARE_PRODUCTS, HOUSEHOLD_PRODUCTS],
        [30, 35, 18, 17],
      )
    } else {
      pool = pickWeighted(
        [FOOD_PRODUCTS, BEVERAGE_PRODUCTS, PERSONAL_CARE_PRODUCTS, HOUSEHOLD_PRODUCTS],
        [40, 20, 22, 18],
      )
    }

    const product = pick(pool)
    // Avoid exact duplicate product IDs in same basket
    if (!items.some((it) => it.product.product_id === product.product_id)) {
      items.push({ product, qty: randInt(1, 4) })
    }
  }

  return items
}

function pickProductsForWholesaleBasket(branchId: string): { product: Product; qty: number }[] {
  const items: { product: Product; qty: number }[] = []
  const numItems = randInt(8, 25)

  // Pattern 1: Lucky Me Pancit Canton + Century Tuna co-purchase in wholesale
  if (rand() > 0.3) {
    const pCantonId = pick(PANCIT_CANTON_IDS)
    const pCantonProd = PRODUCTS.find((p) => p.product_id === pCantonId)!
    items.push({ product: pCantonProd, qty: randInt(12, 48) }) // case quantities

    if (rand() > 0.25) {
      const tunaId = pick(CENTURY_TUNA_IDS)
      const tunaProd = PRODUCTS.find((p) => p.product_id === tunaId)!
      items.push({ product: tunaProd, qty: randInt(12, 36) })
    }
  }

  const remaining = numItems - items.length
  for (let i = 0; i < remaining; i++) {
    const pool = pickWeighted(
      [FOOD_PRODUCTS, BEVERAGE_PRODUCTS, PERSONAL_CARE_PRODUCTS, HOUSEHOLD_PRODUCTS],
      [40, 25, 20, 15],
    )
    const product = pick(pool)
    if (!items.some((it) => it.product.product_id === product.product_id)) {
      items.push({ product, qty: randInt(6, 48) })
    }
  }

  return items
}

function pickPaymentMethod(txnType: string, monthIndex: number): string {
  // Pattern 9: GCash adoption increasing month over month
  const gcashBoost = monthIndex * 0.02 // +2% per month

  if (txnType === 'retail') {
    return pickWeighted(
      ['cash', 'gcash', 'card', 'credit'],
      [0.60 - gcashBoost, 0.20 + gcashBoost, 0.15, 0.05],
    )
  } else {
    return pickWeighted(
      ['credit', 'cash', 'gcash', 'card'],
      [0.40, 0.35 - gcashBoost, 0.20 + gcashBoost, 0.05],
    )
  }
}

function pickHour(txnType: string): number {
  if (txnType === 'retail') {
    // Peak 9-11am and 4-7pm
    return pickWeighted(
      [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      [3, 6, 12, 12, 10, 6, 5, 5, 6, 10, 12, 10, 6, 3],
    )
  } else {
    // Wholesale: business hours, peak Tue/Wed morning
    return pickWeighted(
      [7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      [5, 10, 15, 15, 10, 5, 8, 10, 8, 5],
    )
  }
}

// Branch weights for transaction distribution
const BRANCH_WEIGHTS: Record<string, number> = {
  BAYMALL: 22,
  PLAZA: 16,
  SHOPON: 14,
  BAUAN: 12,
  LEMERY: 11,
  TANAUAN: 16,
  CALAPAN: 9,
}

console.log('Generating transactions...')

// Generate transactions day by day
for (let day = 0; day < TOTAL_DAYS; day++) {
  const date = addDays(START_DATE, day)
  const dayOfWeek = date.getDay() // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const monthIndex = Math.floor(day / 30)

  // Pattern 8: Weekend retail baskets 30% larger
  const weekendMultiplier = isWeekend ? 1.3 : 1.0

  // Daily transaction counts per branch
  for (const branch of BRANCHES) {
    const branchWeight = BRANCH_WEIGHTS[branch.branch_id]

    // Retail: ~300-450/day across all branches, weighted by branch size
    let retailCount = Math.round((randInt(250, 400) * branchWeight) / 100)
    if (isWeekend) retailCount = Math.round(retailCount * 1.2)

    // Wholesale: ~12-30/day across all branches
    let wholesaleCount = Math.round((randInt(12, 28) * branchWeight) / 100)
    // Pattern 4: wholesale peak on Tue/Wed
    if (dayOfWeek === 2 || dayOfWeek === 3) wholesaleCount = Math.round(wholesaleCount * 1.4)

    // === RETAIL TRANSACTIONS ===
    for (let t = 0; t < retailCount; t++) {
      const hour = pickHour('retail')
      const minute = randInt(0, 59)
      const txnDate = new Date(date)
      txnDate.setHours(hour, minute, randInt(0, 59))

      // 40% linked to loyalty, 60% anonymous
      let customerId: string | null = null
      if (rand() < 0.4) {
        // Check for churning pattern
        const candidateId = pick(RETAIL_IDS)
        if (CHURNING_RETAIL.includes(candidateId)) {
          // Pattern 10: these customers dropped from weekly to monthly
          // Only generate transactions for them in specific windows
          if (monthIndex <= 2) {
            // First 3 months: weekly
            customerId = candidateId
          } else if (day % 30 < 5) {
            // Last 3 months: monthly (first 5 days of each month-period)
            customerId = candidateId
          } else {
            customerId = pick(RETAIL_IDS.filter((id) => !CHURNING_RETAIL.includes(id)))
          }
        } else {
          customerId = candidateId
        }
      }

      const basketItems = pickProductsForRetailBasket(branch.branch_id, hour, dayOfWeek)

      // Pattern 8: Weekend baskets larger
      if (isWeekend && rand() > 0.4) {
        // Add a few more items on weekends
        const extraCount = randInt(1, 3)
        for (let e = 0; e < extraCount; e++) {
          const pool = pick([FOOD_PRODUCTS, BEVERAGE_PRODUCTS, PERSONAL_CARE_PRODUCTS, HOUSEHOLD_PRODUCTS])
          const product = pick(pool)
          if (!basketItems.some((it) => it.product.product_id === product.product_id)) {
            basketItems.push({ product, qty: randInt(1, 3) })
          }
        }
      }

      if (basketItems.length === 0) continue

      let totalAmount = 0
      const txnId = genTxnId(branch.branch_id, txnDate)
      const txnItems: TransactionItem[] = []

      for (const item of basketItems) {
        const lineTotal = Math.round(item.product.retail_price * item.qty * 100) / 100
        totalAmount += lineTotal
        txnItems.push({
          transaction_id: txnId,
          product_id: item.product.product_id,
          quantity: item.qty,
          unit_price: item.product.retail_price,
          line_total: lineTotal,
          is_wholesale_price: false,
        })
      }

      totalAmount = Math.round(totalAmount * 100) / 100
      const paymentMethod = pickPaymentMethod('retail', monthIndex)

      TRANSACTIONS.push({
        transaction_id: txnId,
        customer_id: customerId,
        branch_id: branch.branch_id,
        transaction_date: fmtTimestamp(txnDate),
        transaction_type: 'retail',
        payment_method: paymentMethod,
        total_amount: totalAmount,
        items_count: basketItems.length,
        loyalty_points_earned: customerId ? Math.floor(totalAmount / 50) : 0,
      })

      TRANSACTION_ITEMS.push(...txnItems)
    }

    // === WHOLESALE TRANSACTIONS ===
    for (let t = 0; t < wholesaleCount; t++) {
      const hour = pickHour('wholesale')
      const minute = randInt(0, 59)
      const txnDate = new Date(date)
      txnDate.setHours(hour, minute, randInt(0, 59))

      let customerId: string

      // Pattern 4: declining Lemery wholesale
      if (branch.branch_id === 'LEMERY' && rand() < 0.3 && DECLINING_LEMERY.length > 0) {
        const candidate = pick(DECLINING_LEMERY)
        // Reduce frequency in last 2 months
        if (monthIndex >= 4 && rand() < 0.6) {
          // Skip this transaction 60% of the time in last 2 months
          customerId = pick(WHOLESALE_IDS)
        } else {
          customerId = candidate
        }
      }
      // Pattern 6: growing Bauan wholesale
      else if (branch.branch_id === 'BAUAN' && rand() < 0.15) {
        customerId = GROWING_BAUAN
      } else {
        customerId = pick(WHOLESALE_IDS)
      }

      const basketItems = pickProductsForWholesaleBasket(branch.branch_id)

      // Pattern 6: Bauan growing customer gets bigger baskets over time
      if (customerId === GROWING_BAUAN) {
        const growthFactor = 1 + monthIndex * 0.12
        for (const item of basketItems) {
          item.qty = Math.round(item.qty * growthFactor)
        }
      }

      if (basketItems.length === 0) continue

      let totalAmount = 0
      const txnId = genTxnId(branch.branch_id, txnDate)
      const txnItems: TransactionItem[] = []

      for (const item of basketItems) {
        const lineTotal = Math.round(item.product.wholesale_price * item.qty * 100) / 100
        totalAmount += lineTotal
        txnItems.push({
          transaction_id: txnId,
          product_id: item.product.product_id,
          quantity: item.qty,
          unit_price: item.product.wholesale_price,
          line_total: lineTotal,
          is_wholesale_price: true,
        })
      }

      totalAmount = Math.round(totalAmount * 100) / 100
      const paymentMethod = pickPaymentMethod('wholesale', monthIndex)

      TRANSACTIONS.push({
        transaction_id: txnId,
        customer_id: customerId,
        branch_id: branch.branch_id,
        transaction_date: fmtTimestamp(txnDate),
        transaction_type: 'wholesale',
        payment_method: paymentMethod,
        total_amount: totalAmount,
        items_count: basketItems.length,
        loyalty_points_earned: 0,
      })

      TRANSACTION_ITEMS.push(...txnItems)
    }
  }
}

console.log(`Generated ${TRANSACTIONS.length} transactions with ${TRANSACTION_ITEMS.length} line items`)

// ─── 5. WHOLESALE PAYMENTS ─────────────────────────────────────
interface WholesalePayment {
  payment_id: string
  customer_id: string
  amount_paid: number
  payment_date: string
  days_overdue: number
  outstanding_balance: number
}

const WHOLESALE_PAYMENTS: WholesalePayment[] = []
let paymentCounter = 0

// Get credit transactions for each wholesale customer
const creditTxnsByCustomer: Record<string, Transaction[]> = {}
for (const txn of TRANSACTIONS) {
  if (txn.transaction_type === 'wholesale' && txn.payment_method === 'credit' && txn.customer_id) {
    if (!creditTxnsByCustomer[txn.customer_id]) {
      creditTxnsByCustomer[txn.customer_id] = []
    }
    creditTxnsByCustomer[txn.customer_id].push(txn)
  }
}

for (const [custId, txns] of Object.entries(creditTxnsByCustomer)) {
  const customer = CUSTOMERS.find((c) => c.customer_id === custId)
  if (!customer) continue

  const termsDays = customer.credit_terms_days ?? 15
  let runningBalance = 0

  // Sort transactions by date
  const sorted = txns.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

  // Generate payments roughly monthly
  for (const txn of sorted) {
    runningBalance += txn.total_amount
  }

  // Create payment entries
  let paid = 0
  const monthlyPayments = Math.ceil(sorted.length / 4) // roughly 1 payment per batch of orders

  for (let i = 0; i < monthlyPayments; i++) {
    paymentCounter++
    const refTxn = sorted[Math.min(i * 4, sorted.length - 1)]
    const txnDate = new Date(refTxn.transaction_date)
    const dueDate = addDays(txnDate, termsDays)

    let daysOverdue: number

    // Pattern 5: consistently overdue
    if (OVERDUE_WHOLESALE.includes(custId)) {
      daysOverdue = randInt(10, 20)
    }
    // Deteriorating customer
    else if (custId === DETERIORATING_WHOLESALE) {
      // Was on time 3 months ago, now 20+ days overdue
      const monthsFromStart = daysBetween(START_DATE, txnDate) / 30
      if (monthsFromStart < 2) {
        daysOverdue = randInt(0, 3)
      } else if (monthsFromStart < 4) {
        daysOverdue = randInt(5, 12)
      } else {
        daysOverdue = randInt(18, 28)
      }
    }
    // Normal: most pay on time
    else if (rand() < 0.6) {
      daysOverdue = randInt(0, 3)
    } else if (rand() < 0.7) {
      daysOverdue = randInt(3, 8)
    } else {
      daysOverdue = randInt(5, 15)
    }

    const paymentDate = addDays(dueDate, daysOverdue)
    const paymentAmount = Math.round((runningBalance / monthlyPayments) * (0.85 + rand() * 0.15) * 100) / 100
    paid += paymentAmount

    WHOLESALE_PAYMENTS.push({
      payment_id: `PAY-${pad(paymentCounter, 6)}`,
      customer_id: custId,
      amount_paid: paymentAmount,
      payment_date: fmtDate(paymentDate),
      days_overdue: daysOverdue,
      outstanding_balance: Math.max(0, Math.round((runningBalance - paid) * 100) / 100),
    })
  }
}

console.log(`Generated ${WHOLESALE_PAYMENTS.length} wholesale payments`)

// ─── 6. ML OUTPUT TABLES ───────────────────────────────────────

// --- Customer Segments (RFM) ---
interface CustomerSegment {
  customer_id: string
  segment_name: string
  rfm_recency: number
  rfm_frequency: number
  rfm_monetary: number
  r_score: number
  f_score: number
  m_score: number
  cluster_id: number
}

const CUSTOMER_SEGMENTS: CustomerSegment[] = []

// Calculate actual RFM from transaction data
const custTxns: Record<string, { lastDate: Date; count: number; totalSpend: number }> = {}
for (const txn of TRANSACTIONS) {
  if (!txn.customer_id) continue
  if (!custTxns[txn.customer_id]) {
    custTxns[txn.customer_id] = { lastDate: new Date(txn.transaction_date), count: 0, totalSpend: 0 }
  }
  const entry = custTxns[txn.customer_id]
  const txnDate = new Date(txn.transaction_date)
  if (txnDate > entry.lastDate) entry.lastDate = txnDate
  entry.count++
  entry.totalSpend += txn.total_amount
}

const SEGMENT_NAMES = ['Champions', 'Loyal Customers', 'Potential Loyalists', 'Recent Customers', 'At Risk', 'Hibernating', 'Lost']

for (const cust of CUSTOMERS) {
  const stats = custTxns[cust.customer_id]
  if (!stats) continue

  const recency = daysBetween(stats.lastDate, END_DATE)
  const frequency = stats.count
  const monetary = Math.round(stats.totalSpend * 100) / 100

  // Score 1-5 for each
  const rScore = recency <= 7 ? 5 : recency <= 14 ? 4 : recency <= 30 ? 3 : recency <= 60 ? 2 : 1
  const fScore = frequency >= 30 ? 5 : frequency >= 15 ? 4 : frequency >= 8 ? 3 : frequency >= 3 ? 2 : 1
  const mThreshold = cust.customer_type === 'wholesale' ? [50000, 25000, 10000, 3000] : [5000, 2000, 800, 300]
  const mScore = monetary >= mThreshold[0] ? 5 : monetary >= mThreshold[1] ? 4 : monetary >= mThreshold[2] ? 3 : monetary >= mThreshold[3] ? 2 : 1

  const totalScore = rScore + fScore + mScore
  let segmentName: string
  let clusterId: number

  if (totalScore >= 13) { segmentName = 'Champions'; clusterId = 0 }
  else if (totalScore >= 11) { segmentName = 'Loyal Customers'; clusterId = 1 }
  else if (totalScore >= 9) { segmentName = 'Potential Loyalists'; clusterId = 2 }
  else if (rScore >= 4 && totalScore >= 7) { segmentName = 'Recent Customers'; clusterId = 3 }
  else if (rScore <= 2 && fScore >= 3) { segmentName = 'At Risk'; clusterId = 4 }
  else if (rScore <= 2 && fScore <= 2) { segmentName = 'Hibernating'; clusterId = 5 }
  else { segmentName = 'Lost'; clusterId = 6 }

  // Override for churning retail customers
  if (CHURNING_RETAIL.includes(cust.customer_id)) {
    segmentName = 'At Risk'
    clusterId = 4
  }

  CUSTOMER_SEGMENTS.push({
    customer_id: cust.customer_id,
    segment_name: segmentName,
    rfm_recency: recency,
    rfm_frequency: frequency,
    rfm_monetary: monetary,
    r_score: rScore,
    f_score: fScore,
    m_score: mScore,
    cluster_id: clusterId,
  })
}

console.log(`Generated ${CUSTOMER_SEGMENTS.length} customer segments`)

// --- Churn Scores ---
interface ChurnScore {
  customer_id: string
  churn_probability: number
  risk_level: string
  days_since_last: number
  frequency_change: number
  basket_change: number
  top_risk_factor: string
}

const CHURN_SCORES: ChurnScore[] = []

for (const cust of CUSTOMERS) {
  const stats = custTxns[cust.customer_id]
  if (!stats) continue

  const daysSinceLast = daysBetween(stats.lastDate, END_DATE)
  let churnProb: number
  let riskLevel: string
  let frequencyChange: number
  let basketChange: number
  let topRiskFactor: string

  if (CHURNING_RETAIL.includes(cust.customer_id)) {
    churnProb = 0.75 + rand() * 0.2
    riskLevel = 'high'
    frequencyChange = -(0.5 + rand() * 0.3) // -50 to -80% frequency
    basketChange = -(0.1 + rand() * 0.2)
    topRiskFactor = 'Sharp drop in visit frequency from weekly to monthly'
  } else if (DECLINING_LEMERY.includes(cust.customer_id)) {
    churnProb = 0.55 + rand() * 0.25
    riskLevel = 'high'
    frequencyChange = -(0.3 + rand() * 0.3)
    basketChange = -(0.05 + rand() * 0.15)
    topRiskFactor = 'Declining order frequency over last 2 months'
  } else if (daysSinceLast > 45) {
    churnProb = 0.4 + rand() * 0.3
    riskLevel = 'medium'
    frequencyChange = -(0.1 + rand() * 0.2)
    basketChange = rand() * 0.1 - 0.05
    topRiskFactor = 'Extended period without visit'
  } else if (daysSinceLast > 30) {
    churnProb = 0.2 + rand() * 0.2
    riskLevel = 'medium'
    frequencyChange = rand() * 0.1 - 0.05
    basketChange = rand() * 0.1 - 0.05
    topRiskFactor = 'Moderate gap since last visit'
  } else {
    churnProb = rand() * 0.2
    riskLevel = 'low'
    frequencyChange = rand() * 0.2 - 0.05
    basketChange = rand() * 0.15 - 0.05
    topRiskFactor = 'Stable customer'
  }

  CHURN_SCORES.push({
    customer_id: cust.customer_id,
    churn_probability: Math.round(churnProb * 10000) / 10000,
    risk_level: riskLevel,
    days_since_last: daysSinceLast,
    frequency_change: Math.round(frequencyChange * 100) / 100,
    basket_change: Math.round(basketChange * 100) / 100,
    top_risk_factor: topRiskFactor,
  })
}

console.log(`Generated ${CHURN_SCORES.length} churn scores`)

// --- Credit Risk Scores ---
interface CreditRiskScore {
  customer_id: string
  risk_score: number
  risk_level: string
  outstanding_balance: number
  credit_utilization: number
  avg_days_overdue: number
  payment_trend: string
  top_risk_factor: string
}

const CREDIT_RISK_SCORES: CreditRiskScore[] = []

for (const custId of WHOLESALE_IDS) {
  const customer = CUSTOMERS.find((c) => c.customer_id === custId)
  if (!customer) continue

  const payments = WHOLESALE_PAYMENTS.filter((p) => p.customer_id === custId)
  const avgOverdue = payments.length > 0 ? payments.reduce((s, p) => s + p.days_overdue, 0) / payments.length : 0
  const lastBalance = payments.length > 0 ? payments[payments.length - 1].outstanding_balance : 0
  const creditLimit = customer.credit_limit ?? 50000
  const utilization = Math.min(1, lastBalance / creditLimit)

  let riskScore: number
  let riskLevel: string
  let paymentTrend: string
  let topRiskFactor: string

  if (OVERDUE_WHOLESALE.includes(custId)) {
    riskScore = 0.75 + rand() * 0.2
    riskLevel = 'high'
    paymentTrend = 'worsening'
    topRiskFactor = 'Consistently 10-20 days overdue on payments'
  } else if (custId === DETERIORATING_WHOLESALE) {
    riskScore = 0.6 + rand() * 0.2
    riskLevel = 'high'
    paymentTrend = 'worsening'
    topRiskFactor = 'Payment behavior deteriorating — was on-time, now 20+ days overdue'
  } else if (avgOverdue > 8) {
    riskScore = 0.4 + rand() * 0.2
    riskLevel = 'medium'
    paymentTrend = 'stable'
    topRiskFactor = 'Moderate payment delays averaging 8+ days'
  } else {
    riskScore = rand() * 0.25
    riskLevel = 'low'
    paymentTrend = 'improving'
    topRiskFactor = 'Payments generally on time'
  }

  CREDIT_RISK_SCORES.push({
    customer_id: custId,
    risk_score: Math.round(riskScore * 10000) / 10000,
    risk_level: riskLevel,
    outstanding_balance: lastBalance,
    credit_utilization: Math.round(utilization * 100) / 100,
    avg_days_overdue: Math.round(avgOverdue * 10) / 10,
    payment_trend: paymentTrend,
    top_risk_factor: topRiskFactor,
  })
}

console.log(`Generated ${CREDIT_RISK_SCORES.length} credit risk scores`)

// --- Product Associations ---
interface ProductAssociation {
  product_a_id: string
  product_b_id: string
  support: number
  confidence_a_to_b: number
  confidence_b_to_a: number
  lift: number
  transaction_type: string
  branch_id: string | null
}

const PRODUCT_ASSOCIATIONS: ProductAssociation[] = []

// Pattern 1: Lucky Me Pancit Canton + Century Tuna (wholesale)
for (const pId of PANCIT_CANTON_IDS.slice(0, 3)) {
  for (const tId of CENTURY_TUNA_IDS.slice(0, 3)) {
    PRODUCT_ASSOCIATIONS.push({
      product_a_id: pId,
      product_b_id: tId,
      support: Math.round((0.08 + rand() * 0.04) * 10000) / 10000,
      confidence_a_to_b: Math.round((0.55 + rand() * 0.15) * 10000) / 10000,
      confidence_b_to_a: Math.round((0.4 + rand() * 0.15) * 10000) / 10000,
      lift: Math.round((2.5 + rand() * 1.5) * 10000) / 10000,
      transaction_type: 'wholesale',
      branch_id: null,
    })
  }
}

// Pattern 2: Nescafe 3in1 + Rebisco Crackers (retail)
for (const cId of NESCAFE_3IN1_IDS) {
  for (const rId of REBISCO_IDS) {
    PRODUCT_ASSOCIATIONS.push({
      product_a_id: cId,
      product_b_id: rId,
      support: Math.round((0.05 + rand() * 0.03) * 10000) / 10000,
      confidence_a_to_b: Math.round((0.45 + rand() * 0.2) * 10000) / 10000,
      confidence_b_to_a: Math.round((0.35 + rand() * 0.15) * 10000) / 10000,
      lift: Math.round((3.0 + rand() * 2.0) * 10000) / 10000,
      transaction_type: 'retail',
      branch_id: null,
    })
  }
}

// Additional common pairs
const COMMON_PAIRS: [string, string, string][] = [
  ['Datu Puti Vinegar 385ml', 'Datu Puti Soy Sauce 385ml', 'retail'],
  ['UFC Banana Ketchup 320g', 'Mang Tomas All-Purpose Sauce Regular 330g', 'retail'],
  ['Gardenia Classic White 400g', 'Bear Brand Sterilized 200ml', 'retail'],
  ['Well-Milled Rice 5kg', 'Minola Coconut Oil 485ml', 'retail'],
  ['Surf Powder Detergent Rose Fresh 1.1kg', 'Joy Dishwashing Liquid Lemon 250ml', 'retail'],
  ['Coca-Cola Mismo 295ml', 'Chippy BBQ 110g', 'retail'],
  ['Argentina Corned Beef 150g', 'Well-Milled Rice 5kg', 'retail'],
  ['Red Horse Beer 500ml', 'Chippy BBQ 110g', 'retail'],
  ['Safeguard Pure White 130g', 'Colgate Great Regular Flavor 74ml', 'retail'],
  ['Alaska Evaporada 370ml', 'Royal Pasta Spaghetti 450g', 'wholesale'],
]

for (const [nameA, nameB, txnType] of COMMON_PAIRS) {
  try {
    const aId = findProductId(nameA)
    const bId = findProductId(nameB)
    PRODUCT_ASSOCIATIONS.push({
      product_a_id: aId,
      product_b_id: bId,
      support: Math.round((0.03 + rand() * 0.04) * 10000) / 10000,
      confidence_a_to_b: Math.round((0.25 + rand() * 0.2) * 10000) / 10000,
      confidence_b_to_a: Math.round((0.2 + rand() * 0.15) * 10000) / 10000,
      lift: Math.round((1.5 + rand() * 1.5) * 10000) / 10000,
      transaction_type: txnType,
      branch_id: null,
    })
  } catch {
    // Skip if product not found
  }
}

console.log(`Generated ${PRODUCT_ASSOCIATIONS.length} product associations`)

// --- Demand Forecasts ---
interface DemandForecast {
  category: string
  branch_id: string
  forecast_date: string
  predicted_quantity: number
  lower_bound: number
  upper_bound: number
  based_on_period: string
}

const DEMAND_FORECASTS: DemandForecast[] = []

const TOP_CATEGORIES = ['Instant Noodles', 'Canned Goods', 'Condiments', 'Coffee', 'Soft Drinks', 'Rice & Grains', 'Snacks', 'Soap', 'Laundry', 'Milk']

for (const category of TOP_CATEGORIES) {
  for (const branch of BRANCHES) {
    // Generate 30 days of forecasts
    for (let d = 0; d < 30; d++) {
      const forecastDate = addDays(END_DATE, d)
      const isWeekend = forecastDate.getDay() === 0 || forecastDate.getDay() === 6

      // Base demand varies by category and branch size
      let baseDemand = (BRANCH_WEIGHTS[branch.branch_id] / 15) * (randInt(20, 80))
      if (isWeekend) baseDemand *= 1.25
      if (branch.branch_id === 'TANAUAN' && (category === 'Soft Drinks' || category === 'Coffee')) {
        baseDemand *= 1.35
      }
      if (branch.branch_id === 'CALAPAN' && (category === 'Soap' || category === 'Laundry')) {
        baseDemand *= 1.3
      }

      const predicted = Math.round(baseDemand * 100) / 100
      const variance = predicted * 0.15
      DEMAND_FORECASTS.push({
        category,
        branch_id: branch.branch_id,
        forecast_date: fmtDate(forecastDate),
        predicted_quantity: predicted,
        lower_bound: Math.round((predicted - variance) * 100) / 100,
        upper_bound: Math.round((predicted + variance) * 100) / 100,
        based_on_period: '2025-09-01 to 2026-03-01',
      })
    }
  }
}

console.log(`Generated ${DEMAND_FORECASTS.length} demand forecasts`)

// --- Insight Cards ---
interface InsightCard {
  severity: string
  title: string
  body: string
  action: string
  related_intent: string
  related_params: object
  is_active: boolean
}

const INSIGHT_CARDS: InsightCard[] = [
  {
    severity: 'critical',
    title: 'Credit Risk Alert: 2 wholesale accounts consistently overdue',
    body: `Wholesale accounts ${OVERDUE_WHOLESALE[0]} and ${OVERDUE_WHOLESALE[1]} have been consistently 10-20 days overdue on credit payments over the past 3 months. Combined outstanding balance exceeds ₱85,000. Immediate review recommended.`,
    action: 'Review credit terms and contact customers for payment plan discussion',
    related_intent: 'credit_risk',
    related_params: { customer_ids: OVERDUE_WHOLESALE },
    is_active: true,
  },
  {
    severity: 'warning',
    title: 'Declining wholesale orders in Lemery branch',
    body: `${DECLINING_LEMERY.length} wholesale buyers in Lemery have reduced their order frequency by 40-60% over the past 2 months. This may indicate competitive pressure or customer dissatisfaction.`,
    action: 'Schedule account review meetings with declining Lemery wholesale customers',
    related_intent: 'churn_risk',
    related_params: { branch_id: 'LEMERY', customer_ids: DECLINING_LEMERY },
    is_active: true,
  },
  {
    severity: 'warning',
    title: '12 loyal retail customers showing churn signals',
    body: 'A cluster of 12 loyalty card holders who previously visited weekly have dropped to monthly visits over the last 3 months. Combined lifetime value exceeds ₱180,000.',
    action: 'Launch targeted re-engagement campaign with personalized offers for at-risk loyalty members',
    related_intent: 'churn_risk',
    related_params: { customer_type: 'retail', segment: 'At Risk' },
    is_active: true,
  },
  {
    severity: 'info',
    title: 'High-frequency co-purchase: Pancit Canton + Century Tuna in wholesale',
    body: 'Lucky Me Pancit Canton and Century Tuna are co-purchased in 55-70% of wholesale transactions. This strong association suggests bundling opportunity for trade promotions.',
    action: 'Create wholesale bundle deal: Pancit Canton + Century Tuna combo pricing',
    related_intent: 'product_association',
    related_params: { transaction_type: 'wholesale' },
    is_active: true,
  },
  {
    severity: 'info',
    title: 'Morning coffee + crackers pattern detected',
    body: 'Nescafe 3-in-1 and Rebisco Crackers show high co-occurrence (45-65% confidence) in retail transactions before 10am. Opportunity for morning bundle promotion.',
    action: 'Set up in-store "morning bundle" display near checkout with coffee + crackers combo',
    related_intent: 'product_association',
    related_params: { transaction_type: 'retail', time_window: 'morning' },
    is_active: true,
  },
  {
    severity: 'info',
    title: 'Tanauan branch: disproportionately high beverage sales',
    body: 'Citimart Tanauan shows 35% higher beverage sales proportion compared to other Batangas branches. Soft drinks, coffee, and water categories are particularly strong.',
    action: 'Increase beverage shelf allocation at Tanauan branch and negotiate volume discounts with suppliers',
    related_intent: 'branch_performance',
    related_params: { branch_id: 'TANAUAN', category: 'Beverages' },
    is_active: true,
  },
  {
    severity: 'positive',
    title: 'Growing wholesale account in Bauan',
    body: `Wholesale customer ${GROWING_BAUAN} has shown consistent month-over-month order growth of 12-15% over the past 6 months. Current trajectory suggests potential for credit limit increase.`,
    action: 'Offer loyalty incentives and review credit limit for growing Bauan account',
    related_intent: 'customer_growth',
    related_params: { customer_id: GROWING_BAUAN, branch_id: 'BAUAN' },
    is_active: true,
  },
  {
    severity: 'info',
    title: 'GCash adoption increasing steadily',
    body: 'GCash payment usage has increased from 20% to 32% of retail transactions over the past 6 months. Cash transactions have declined proportionally. Trend expected to continue.',
    action: 'Ensure GCash integration reliability and consider GCash-exclusive promotions to accelerate adoption',
    related_intent: 'payment_trends',
    related_params: { payment_method: 'gcash' },
    is_active: true,
  },
]

console.log(`Generated ${INSIGHT_CARDS.length} insight cards`)

// ─── DATABASE INSERTION ────────────────────────────────────────

function escapeStr(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

function numOrNull(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'NULL'
  return String(n)
}

function boolVal(b: boolean): string {
  return b ? 'true' : 'false'
}

function jsonVal(obj: object): string {
  return escapeStr(JSON.stringify(obj))
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log('\nConnecting to database...')
  const sql = postgres(dbUrl, { prepare: false, max: 5 })

  try {
    // Clear existing data (reverse dependency order)
    console.log('Clearing existing data...')
    await sql`TRUNCATE TABLE insight_cards, demand_forecasts, product_associations, credit_risk_scores, churn_scores, customer_segments, wholesale_payments, transaction_items, transactions, customers, products, branches CASCADE`

    // 1. Insert branches
    console.log('Inserting branches...')
    await sql`
      INSERT INTO branches (branch_id, branch_name, address, municipality, province, opening_date, floor_area_sqm, is_active)
      VALUES ${sql(BRANCHES.map((b) => [b.branch_id, b.branch_name, b.address, b.municipality, b.province, b.opening_date, b.floor_area_sqm, true]))}
    `

    // 2. Insert products
    console.log('Inserting products...')
    const productChunks = chunk(PRODUCTS, 500)
    for (const batch of productChunks) {
      await sql`
        INSERT INTO products (product_id, product_name, brand, category, subcategory, department, retail_price, wholesale_price, supplier, is_active)
        VALUES ${sql(batch.map((p) => [p.product_id, p.product_name, p.brand, p.category, p.subcategory, p.department, p.retail_price, p.wholesale_price, p.supplier, true]))}
      `
    }

    // 3. Insert customers
    console.log('Inserting customers...')
    const customerChunks = chunk(CUSTOMERS, 500)
    for (const batch of customerChunks) {
      await sql`
        INSERT INTO customers (customer_id, customer_type, first_name, last_name, phone, email, loyalty_card_number, wholesale_member_id, business_name, barangay, municipality, registration_date, credit_limit, credit_terms_days, status)
        VALUES ${sql(batch.map((c) => [c.customer_id, c.customer_type, c.first_name, c.last_name, c.phone, c.email, c.loyalty_card_number, c.wholesale_member_id, c.business_name, c.barangay, c.municipality, c.registration_date, c.credit_limit, c.credit_terms_days, c.status]))}
      `
    }

    // 4. Insert transactions
    console.log('Inserting transactions...')
    const txnChunks = chunk(TRANSACTIONS, 3000)
    for (let i = 0; i < txnChunks.length; i++) {
      const batch = txnChunks[i]
      await sql`
        INSERT INTO transactions (transaction_id, customer_id, branch_id, transaction_date, transaction_type, payment_method, total_amount, items_count, loyalty_points_earned)
        VALUES ${sql(batch.map((t) => [t.transaction_id, t.customer_id, t.branch_id, t.transaction_date, t.transaction_type, t.payment_method, t.total_amount, t.items_count, t.loyalty_points_earned]))}
      `
      if ((i + 1) % 5 === 0) console.log(`  Transactions: ${Math.min((i + 1) * 3000, TRANSACTIONS.length)}/${TRANSACTIONS.length}`)
    }

    // 5. Insert transaction items
    console.log('Inserting transaction items...')
    const itemChunks = chunk(TRANSACTION_ITEMS, 5000)
    for (let i = 0; i < itemChunks.length; i++) {
      const batch = itemChunks[i]
      await sql`
        INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, line_total, is_wholesale_price)
        VALUES ${sql(batch.map((it) => [it.transaction_id, it.product_id, it.quantity, it.unit_price, it.line_total, it.is_wholesale_price]))}
      `
      if ((i + 1) % 10 === 0) console.log(`  Items: ${Math.min((i + 1) * 5000, TRANSACTION_ITEMS.length)}/${TRANSACTION_ITEMS.length}`)
    }

    // 6. Insert wholesale payments
    console.log('Inserting wholesale payments...')
    if (WHOLESALE_PAYMENTS.length > 0) {
      const payChunks = chunk(WHOLESALE_PAYMENTS, 1000)
      for (const batch of payChunks) {
        await sql`
          INSERT INTO wholesale_payments (payment_id, customer_id, amount_paid, payment_date, days_overdue, outstanding_balance)
          VALUES ${sql(batch.map((p) => [p.payment_id, p.customer_id, p.amount_paid, p.payment_date, p.days_overdue, p.outstanding_balance]))}
        `
      }
    }

    // 7. Insert customer segments
    console.log('Inserting customer segments...')
    const segChunks = chunk(CUSTOMER_SEGMENTS, 500)
    for (const batch of segChunks) {
      await sql`
        INSERT INTO customer_segments (customer_id, segment_name, rfm_recency, rfm_frequency, rfm_monetary, r_score, f_score, m_score, cluster_id)
        VALUES ${sql(batch.map((s) => [s.customer_id, s.segment_name, s.rfm_recency, s.rfm_frequency, s.rfm_monetary, s.r_score, s.f_score, s.m_score, s.cluster_id]))}
      `
    }

    // 8. Insert churn scores
    console.log('Inserting churn scores...')
    const churnChunks = chunk(CHURN_SCORES, 500)
    for (const batch of churnChunks) {
      await sql`
        INSERT INTO churn_scores (customer_id, churn_probability, risk_level, days_since_last, frequency_change, basket_change, top_risk_factor)
        VALUES ${sql(batch.map((c) => [c.customer_id, c.churn_probability, c.risk_level, c.days_since_last, c.frequency_change, c.basket_change, c.top_risk_factor]))}
      `
    }

    // 9. Insert credit risk scores
    console.log('Inserting credit risk scores...')
    if (CREDIT_RISK_SCORES.length > 0) {
      await sql`
        INSERT INTO credit_risk_scores (customer_id, risk_score, risk_level, outstanding_balance, credit_utilization, avg_days_overdue, payment_trend, top_risk_factor)
        VALUES ${sql(CREDIT_RISK_SCORES.map((c) => [c.customer_id, c.risk_score, c.risk_level, c.outstanding_balance, c.credit_utilization, c.avg_days_overdue, c.payment_trend, c.top_risk_factor]))}
      `
    }

    // 10. Insert product associations
    console.log('Inserting product associations...')
    if (PRODUCT_ASSOCIATIONS.length > 0) {
      await sql`
        INSERT INTO product_associations (product_a_id, product_b_id, support, confidence_a_to_b, confidence_b_to_a, lift, transaction_type, branch_id)
        VALUES ${sql(PRODUCT_ASSOCIATIONS.map((a) => [a.product_a_id, a.product_b_id, a.support, a.confidence_a_to_b, a.confidence_b_to_a, a.lift, a.transaction_type, a.branch_id]))}
      `
    }

    // 11. Insert demand forecasts
    console.log('Inserting demand forecasts...')
    const forecastChunks = chunk(DEMAND_FORECASTS, 2000)
    for (const batch of forecastChunks) {
      await sql`
        INSERT INTO demand_forecasts (category, branch_id, forecast_date, predicted_quantity, lower_bound, upper_bound, based_on_period)
        VALUES ${sql(batch.map((f) => [f.category, f.branch_id, f.forecast_date, f.predicted_quantity, f.lower_bound, f.upper_bound, f.based_on_period]))}
      `
    }

    // 12. Insert insight cards
    console.log('Inserting insight cards...')
    await sql`
      INSERT INTO insight_cards (severity, title, body, action, related_intent, related_params, is_active)
      VALUES ${sql(INSIGHT_CARDS.map((ic) => [ic.severity, ic.title, ic.body, ic.action, ic.related_intent, JSON.stringify(ic.related_params), ic.is_active]))}
    `

    console.log('\n=== SEED COMPLETE ===')
    console.log(`  Branches:              ${BRANCHES.length}`)
    console.log(`  Products:              ${PRODUCTS.length}`)
    console.log(`  Customers:             ${CUSTOMERS.length} (${RETAIL_IDS.length} retail, ${WHOLESALE_IDS.length} wholesale)`)
    console.log(`  Transactions:          ${TRANSACTIONS.length}`)
    console.log(`  Transaction Items:     ${TRANSACTION_ITEMS.length}`)
    console.log(`  Wholesale Payments:    ${WHOLESALE_PAYMENTS.length}`)
    console.log(`  Customer Segments:     ${CUSTOMER_SEGMENTS.length}`)
    console.log(`  Churn Scores:          ${CHURN_SCORES.length}`)
    console.log(`  Credit Risk Scores:    ${CREDIT_RISK_SCORES.length}`)
    console.log(`  Product Associations:  ${PRODUCT_ASSOCIATIONS.length}`)
    console.log(`  Demand Forecasts:      ${DEMAND_FORECASTS.length}`)
    console.log(`  Insight Cards:         ${INSIGHT_CARDS.length}`)
  } finally {
    await sql.end()
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

// If --help flag, just show usage
if (process.argv.includes('--help')) {
  console.log('Usage: npx tsx scripts/seed.ts')
  console.log('')
  console.log('Seeds the database with synthetic demo data.')
  console.log('Requires DATABASE_URL environment variable.')
  console.log('')
  console.log(`Will generate:`)
  console.log(`  ${BRANCHES.length} branches`)
  console.log(`  ${PRODUCTS.length} products`)
  console.log(`  ${CUSTOMERS.length} customers`)
  console.log(`  ${TRANSACTIONS.length} transactions`)
  console.log(`  ${TRANSACTION_ITEMS.length} transaction items`)
  console.log(`  ${WHOLESALE_PAYMENTS.length} wholesale payments`)
  console.log(`  ${CUSTOMER_SEGMENTS.length} customer segments`)
  console.log(`  ${CHURN_SCORES.length} churn scores`)
  console.log(`  ${CREDIT_RISK_SCORES.length} credit risk scores`)
  console.log(`  ${PRODUCT_ASSOCIATIONS.length} product associations`)
  console.log(`  ${DEMAND_FORECASTS.length} demand forecasts`)
  console.log(`  ${INSIGHT_CARDS.length} insight cards`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
