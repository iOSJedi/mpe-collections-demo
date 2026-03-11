# Citimart Data-to-Decision Intelligence System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a predictive analytics POC for a 7-branch grocery chain with conversational BI, customer DNA views, wholesale health monitoring, and ML-powered insights.

**Architecture:** Next.js App Router on Vercel → Supabase Postgres (Drizzle ORM) + Gemini 2.0 Flash for chat AI + AWS Lambda (Python) for ML pipeline. Firebase Auth for login. Redux Toolkit for state. shadcn-style UI components.

**Tech Stack:** Next.js 14+, Tailwind CSS 3.x, Recharts, Redux Toolkit, Firebase Auth, Drizzle ORM, Supabase Postgres, Gemini API, Python 3.11 / scikit-learn / mlxtend / Prophet on AWS Lambda.

**Reference project:** `~/projects/jc-contact-center` — follow its auth, component, and state patterns.

---

## Phase 1: Project Scaffolding & Foundation

### Task 1: Initialize Next.js project

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/next.config.ts`

**Step 1: Create Next.js app with App Router**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Select: Yes to all defaults.

**Step 2: Install all dependencies**

```bash
cd app
npm install @reduxjs/toolkit react-redux firebase firebase-admin \
  drizzle-orm postgres @google/generative-ai @aws-sdk/client-lambda \
  recharts lucide-react @radix-ui/react-slot @radix-ui/react-tabs \
  @radix-ui/react-select @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  class-variance-authority clsx tailwind-merge tailwindcss-animate \
  dotenv
npm install -D drizzle-kit @types/node tsx
```

**Step 3: Update `next.config.ts`**

```typescript
// app/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
}

export default nextConfig
```

**Step 4: Create `.env.example`**

```bash
# app/.env.example
# Supabase
DATABASE_URL=postgresql://...

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Firebase (Server)
FIREBASE_SERVICE_ACCOUNT=

# Gemini
GEMINI_API_KEY=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
LAMBDA_FUNCTION_NAME=citimart-ml-pipeline

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 5: Verify dev server starts**

```bash
cd app && npm run dev
```

Expected: Server starts on localhost:3000.

**Step 6: Commit**

```bash
git add app/
git commit -m "feat: initialize Next.js project with dependencies"
```

---

### Task 2: Tailwind config + design tokens

**Files:**
- Modify: `app/tailwind.config.ts`
- Modify: `app/src/app/globals.css`

**Step 1: Update tailwind.config.ts**

Replace `app/tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: "hsl(var(--warning))",
        success: "hsl(var(--success))",
        info: "hsl(var(--info))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
```

**Step 2: Replace globals.css**

Replace `app/src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --mobile-vh: 100vh;
}

@supports (height: 100svh) {
  :root {
    --mobile-vh: 100svh;
  }
}

body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  min-height: 100svh;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}

@layer base {
  :root {
    --background: 210 17% 98%;         /* #F8F9FA */
    --foreground: 0 0% 20%;            /* #333333 */
    --card: 0 0% 100%;                 /* #FFFFFF */
    --card-foreground: 0 0% 20%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 20%;
    --primary: 216 47% 20%;            /* #1B2A4A deep navy */
    --primary-foreground: 0 0% 100%;
    --secondary: 189 53% 36%;          /* #2A7F8E teal */
    --secondary-foreground: 0 0% 100%;
    --muted: 210 17% 95%;              /* light gray */
    --muted-foreground: 0 0% 40%;
    --accent: 189 53% 36%;             /* teal */
    --accent-foreground: 0 0% 100%;
    --destructive: 354 70% 54%;        /* #DC3545 */
    --destructive-foreground: 0 0% 98%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 189 53% 36%;               /* teal for focus rings */
    --warning: 45 100% 51%;            /* #FFC107 */
    --success: 134 61% 41%;            /* #28A745 */
    --info: 189 53% 36%;               /* teal */
    --chart-1: 216 47% 20%;            /* navy */
    --chart-2: 189 53% 36%;            /* teal */
    --chart-3: 45 100% 51%;            /* yellow */
    --chart-4: 354 70% 54%;            /* red */
    --chart-5: 134 61% 41%;            /* green */
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 3: Verify styling loads**

```bash
npm run dev
```

Visit localhost:3000. Should see off-white background with Inter font.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: configure Tailwind with navy/teal design tokens"
```

---

### Task 3: Base UI components + utilities

**Files:**
- Create: `app/src/lib/utils.ts`
- Create: `app/src/components/ui/button.tsx`
- Create: `app/src/components/ui/card.tsx`
- Create: `app/src/components/ui/input.tsx`
- Create: `app/src/components/ui/badge.tsx`
- Create: `app/src/components/ui/tabs.tsx`
- Create: `app/src/components/ui/select.tsx`
- Create: `app/src/components/ui/dialog.tsx`
- Create: `app/src/components/ui/dropdown-menu.tsx`

**Step 1: Create cn() utility**

```typescript
// app/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, abbreviated = false): string {
  if (abbreviated) {
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(1)}K`
  }
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
```

**Step 2: Create Button component**

Copy the exact pattern from jc-contact-center:

```typescript
// app/src/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

**Step 3: Create Card component**

Copy exact pattern from jc-contact-center:

```typescript
// app/src/components/ui/card.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border bg-card text-card-foreground shadow", className)} {...props} />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**Step 4: Create Input component**

```typescript
// app/src/components/ui/input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
```

**Step 5: Create Badge component**

```typescript
// app/src/components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success text-white",
        warning: "border-transparent bg-warning text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

**Step 6: Create Tabs component**

```typescript
// app/src/components/ui/tabs.tsx
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

**Step 7: Create Select component**

```typescript
// app/src/components/ui/select.tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
```

**Step 8: Verify components build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 9: Commit**

```bash
git add -A && git commit -m "feat: add base UI components and utilities"
```

---

## Phase 2: Authentication

### Task 4: Firebase client + server setup

**Files:**
- Create: `app/src/lib/firebase.ts`
- Create: `app/src/lib/firebase-admin.ts`

**Step 1: Create Firebase client**

```typescript
// app/src/lib/firebase.ts
'use client'

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp
let auth: Auth

if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }
  auth = getAuth(app)
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export async function getIdToken(): Promise<string | null> {
  const user = auth?.currentUser
  if (!user) return null
  return user.getIdToken()
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export { app, auth }
export type { FirebaseUser }
```

**Step 2: Create Firebase admin**

```typescript
// app/src/lib/firebase-admin.ts
import admin from 'firebase-admin'

function getServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT env var is not set')
    return null
  }
  try {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch {
    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON')
    return null
  }
}

let _initialized = false

function ensureInitialized() {
  if (_initialized) return
  _initialized = true

  const serviceAccount = getServiceAccount()
  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

export function getAuth() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.auth() : null
}

export default admin
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Firebase client and admin setup"
```

---

### Task 5: Auth middleware + API routes

**Files:**
- Create: `app/src/lib/auth-middleware.ts`
- Create: `app/src/lib/api.ts`
- Create: `app/src/app/api/auth/login/route.ts`
- Create: `app/src/app/api/auth/me/route.ts`

**Step 1: Create auth middleware**

Simplified version — Firebase Bearer token verification only (no cookies, no MongoDB user model, no cache):

```typescript
// app/src/lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from './firebase-admin'

export interface AuthenticatedUser {
  uid: string
  email: string | undefined
  name: string | undefined
  picture: string | undefined
}

export async function verifyToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const auth = getAuth()
    if (!auth) {
      console.warn('Firebase Auth not initialized')
      return null
    }

    const token = authHeader.substring(7)
    const decodedToken = await auth.verifyIdToken(token)

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return handler(request, user)
  }
}
```

**Step 2: Create apiFetch helper**

```typescript
// app/src/lib/api.ts
import { getIdToken } from '@/lib/firebase'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getIdToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}
```

**Step 3: Create auth login route**

```typescript
// app/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      uid: user.uid,
      username: user.name || user.email || 'User',
      profilePic: user.picture || '',
    },
  })
}
```

**Step 4: Create auth me route**

```typescript
// app/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (_request: NextRequest, user) => {
  return NextResponse.json({
    user: {
      uid: user.uid,
      username: user.name || user.email || 'User',
      profilePic: user.picture || '',
    },
  })
})
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add auth middleware, apiFetch, and auth API routes"
```

---

### Task 6: AuthContext + Providers + Login page

**Files:**
- Create: `app/src/contexts/AuthContext.tsx`
- Create: `app/src/components/Providers.tsx`
- Create: `app/src/components/auth/LoginPage.tsx`

**Step 1: Create AuthContext**

Adapted from jc-contact-center:

```typescript
// app/src/contexts/AuthContext.tsx
'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import {
  signInWithGoogle as firebaseSignIn,
  signOut as firebaseSignOut,
  getIdToken,
  onAuthChange,
  FirebaseUser,
} from '@/lib/firebase'

interface AuthUser {
  uid: string
  username: string
  profilePic: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentUidRef = React.useRef<string | null>(null)
  const initialLoadDoneRef = React.useRef(false)

  const syncWithBackend = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      currentUidRef.current = null
      setUser(null)
      setLoading(false)
      initialLoadDoneRef.current = true
      return
    }

    if (initialLoadDoneRef.current && currentUidRef.current === firebaseUser.uid) {
      return
    }

    try {
      const token = await firebaseUser.getIdToken()
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to sync with backend')

      const data = await response.json()
      currentUidRef.current = firebaseUser.uid
      setUser(data.user)
      setError(null)
    } catch (err) {
      console.error('Backend sync error:', err)
      setError('Failed to authenticate with server')
      setUser(null)
      currentUidRef.current = null
    } finally {
      setLoading(false)
      initialLoadDoneRef.current = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      syncWithBackend(firebaseUser)
    })
    return () => unsubscribe()
  }, [syncWithBackend])

  const signInWithGoogle = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const firebaseUser = await firebaseSignIn()
      await syncWithBackend(firebaseUser)
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with Google')
      setLoading(false)
    }
  }, [syncWithBackend])

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      await firebaseSignOut()
      setUser(null)
      setError(null)
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Failed to sign out')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
```

**Step 2: Create Providers (will add Redux in next task)**

```typescript
// app/src/components/Providers.tsx
'use client'

import { AuthProvider } from '@/contexts/AuthContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>{children}</AuthProvider>
  )
}
```

**Step 3: Create LoginPage**

```typescript
// app/src/components/auth/LoginPage.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Data Intelligence System
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access the analytics dashboard
          </p>
        </div>
        <Button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            'Sign in with Google'
          )}
        </Button>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Update root layout**

```typescript
// app/src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Data Intelligence System',
  description: 'Predictive analytics and data-to-decision intelligence',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**Step 5: Update main page to show login or redirect**

```typescript
// app/src/app/page.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Welcome, {user.username}</h1>
      <p className="text-muted-foreground">Dashboard coming soon.</p>
    </div>
  )
}
```

**Step 6: Verify login flow works**

```bash
npm run dev
```

Visit localhost:3000. Should see login page. (Google Sign-in will only work with valid Firebase config in `.env.local`.)

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add AuthContext, login page, and Providers"
```

---

## Phase 3: Redux Store & Layout Shell

### Task 7: Redux store + all slices

**Files:**
- Create: `app/src/types/index.ts`
- Create: `app/src/store/index.ts`
- Create: `app/src/store/slices/navSlice.ts`
- Create: `app/src/store/slices/chatSlice.ts`
- Create: `app/src/store/slices/customerSlice.ts`
- Create: `app/src/store/slices/wholesaleSlice.ts`
- Create: `app/src/store/slices/branchSlice.ts`
- Create: `app/src/store/slices/analyticsSlice.ts`
- Modify: `app/src/components/Providers.tsx`

**Step 1: Create types**

```typescript
// app/src/types/index.ts
export type NavView = 'dashboard' | 'chat' | 'customers' | 'wholesale' | 'branches' | 'analytics'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chartConfig?: ChartConfig | null
  followUpSuggestions?: string[]
  timestamp: number
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKeys: { key: string; color: string; name: string }[]
  interpretation?: string
}

export interface InsightCard {
  id: number
  severity: 'info' | 'warning' | 'alert' | 'opportunity'
  title: string
  body: string
  action: string | null
  related_intent: string | null
  related_params: Record<string, unknown> | null
  created_at: string
}

export interface CustomerSummary {
  customer_id: string
  customer_type: 'retail' | 'wholesale' | 'both'
  first_name: string
  last_name: string
  business_name: string | null
  segment_name: string | null
  churn_risk: string | null
  total_spend: number
  transaction_count: number
  last_transaction_date: string | null
}

export interface CustomerProfile extends CustomerSummary {
  phone: string | null
  email: string | null
  loyalty_card_number: string | null
  wholesale_member_id: string | null
  barangay: string | null
  municipality: string | null
  registration_date: string
  credit_limit: number | null
  credit_terms_days: number | null
  status: string
  rfm_recency: number | null
  rfm_frequency: number | null
  rfm_monetary: number | null
  churn_probability: number | null
  top_risk_factor: string | null
  credit_risk_level: string | null
  credit_utilization: number | null
  outstanding_balance: number | null
  top_categories: { category: string; total: number }[]
  top_brands: { brand: string; count: number }[]
  monthly_spend: { month: string; total: number }[]
  recent_transactions: {
    transaction_id: string
    date: string
    branch_name: string
    transaction_type: string
    total_amount: number
    items_count: number
  }[]
  recommended_products: { product_name: string; confidence: number }[]
}

export interface WholesaleBuyer {
  customer_id: string
  first_name: string
  last_name: string
  business_name: string
  branch_name: string
  risk_score: number
  risk_level: string
  outstanding_balance: number
  credit_limit: number
  credit_utilization: number
  avg_days_overdue: number
  payment_trend: string
  order_frequency_trend: number
  basket_size_trend: number
  last_order_date: string
  top_risk_factor: string | null
  monthly_totals: { month: string; total: number }[]
}

export interface BranchData {
  branch_id: string
  branch_name: string
  municipality: string
  province: string
  revenue_this_month: number
  revenue_last_month: number
  revenue_change: number
  transaction_count: number
  avg_basket_size: number
  retail_revenue: number
  wholesale_revenue: number
  top_categories: { category: string; total: number }[]
}

export interface AnalysisTask {
  id: string
  name: string
  description: string
  last_run: string | null
  last_summary: string | null
  parameters: { key: string; label: string; type: 'select' | 'date'; options?: { value: string; label: string }[] }[]
}
```

**Step 2: Create navSlice**

```typescript
// app/src/store/slices/navSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { NavView } from '@/types'

interface NavState {
  activeView: NavView
  sidebarCollapsed: boolean
}

const initialState: NavState = {
  activeView: 'dashboard',
  sidebarCollapsed: false,
}

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {
    setActiveView(state, action: PayloadAction<NavView>) {
      state.activeView = action.payload
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { setActiveView, toggleSidebar } = navSlice.actions
export default navSlice.reducer
```

**Step 3: Create chatSlice**

```typescript
// app/src/store/slices/chatSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatMessage, ChartConfig } from '@/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  currentChart: ChartConfig | null
  followUpSuggestions: string[]
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  currentChart: null,
  followUpSuggestions: [],
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload)
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },
    setCurrentChart(state, action: PayloadAction<ChartConfig | null>) {
      state.currentChart = action.payload
    },
    setFollowUpSuggestions(state, action: PayloadAction<string[]>) {
      state.followUpSuggestions = action.payload
    },
    clearChat(state) {
      state.messages = []
      state.currentChart = null
      state.followUpSuggestions = []
    },
  },
})

export const { addMessage, setLoading, setCurrentChart, setFollowUpSuggestions, clearChat } = chatSlice.actions
export default chatSlice.reducer
```

**Step 4: Create customerSlice**

```typescript
// app/src/store/slices/customerSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { CustomerSummary, CustomerProfile } from '@/types'

interface CustomerState {
  customers: CustomerSummary[]
  selectedCustomer: CustomerProfile | null
  loading: boolean
  filters: {
    type: 'all' | 'retail' | 'wholesale' | 'both'
    segment: string
    search: string
  }
}

const initialState: CustomerState = {
  customers: [],
  selectedCustomer: null,
  loading: false,
  filters: { type: 'all', segment: '', search: '' },
}

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setCustomers(state, action: PayloadAction<CustomerSummary[]>) {
      state.customers = action.payload
    },
    setSelectedCustomer(state, action: PayloadAction<CustomerProfile | null>) {
      state.selectedCustomer = action.payload
    },
    setCustomerLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setCustomerFilters(state, action: PayloadAction<Partial<CustomerState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
  },
})

export const { setCustomers, setSelectedCustomer, setCustomerLoading, setCustomerFilters } = customerSlice.actions
export default customerSlice.reducer
```

**Step 5: Create wholesaleSlice**

```typescript
// app/src/store/slices/wholesaleSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WholesaleBuyer } from '@/types'

interface WholesaleState {
  buyers: WholesaleBuyer[]
  loading: boolean
  filters: {
    branch: string
    riskLevel: string
    sortBy: string
  }
}

const initialState: WholesaleState = {
  buyers: [],
  loading: false,
  filters: { branch: 'all', riskLevel: 'all', sortBy: 'risk_score' },
}

const wholesaleSlice = createSlice({
  name: 'wholesale',
  initialState,
  reducers: {
    setBuyers(state, action: PayloadAction<WholesaleBuyer[]>) {
      state.buyers = action.payload
    },
    setWholesaleLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setWholesaleFilters(state, action: PayloadAction<Partial<WholesaleState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
  },
})

export const { setBuyers, setWholesaleLoading, setWholesaleFilters } = wholesaleSlice.actions
export default wholesaleSlice.reducer
```

**Step 6: Create branchSlice**

```typescript
// app/src/store/slices/branchSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { BranchData } from '@/types'

interface BranchState {
  branches: BranchData[]
  loading: boolean
  selectedMetric: 'revenue' | 'transactions' | 'basket_size'
  dateRange: { start: string; end: string }
}

const initialState: BranchState = {
  branches: [],
  loading: false,
  selectedMetric: 'revenue',
  dateRange: { start: '', end: '' },
}

const branchSlice = createSlice({
  name: 'branch',
  initialState,
  reducers: {
    setBranches(state, action: PayloadAction<BranchData[]>) {
      state.branches = action.payload
    },
    setBranchLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setSelectedMetric(state, action: PayloadAction<BranchState['selectedMetric']>) {
      state.selectedMetric = action.payload
    },
    setDateRange(state, action: PayloadAction<{ start: string; end: string }>) {
      state.dateRange = action.payload
    },
  },
})

export const { setBranches, setBranchLoading, setSelectedMetric, setDateRange } = branchSlice.actions
export default branchSlice.reducer
```

**Step 7: Create analyticsSlice**

```typescript
// app/src/store/slices/analyticsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AnalyticsState {
  runningTask: string | null
  lastResults: Record<string, { summary: string; timestamp: string }>
}

const initialState: AnalyticsState = {
  runningTask: null,
  lastResults: {},
}

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setRunningTask(state, action: PayloadAction<string | null>) {
      state.runningTask = action.payload
    },
    setTaskResult(state, action: PayloadAction<{ task: string; summary: string }>) {
      state.lastResults[action.payload.task] = {
        summary: action.payload.summary,
        timestamp: new Date().toISOString(),
      }
    },
  },
})

export const { setRunningTask, setTaskResult } = analyticsSlice.actions
export default analyticsSlice.reducer
```

**Step 8: Create Redux store**

```typescript
// app/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import navReducer from './slices/navSlice'
import chatReducer from './slices/chatSlice'
import customerReducer from './slices/customerSlice'
import wholesaleReducer from './slices/wholesaleSlice'
import branchReducer from './slices/branchSlice'
import analyticsReducer from './slices/analyticsSlice'

export const store = configureStore({
  reducer: {
    nav: navReducer,
    chat: chatReducer,
    customer: customerReducer,
    wholesale: wholesaleReducer,
    branch: branchReducer,
    analytics: analyticsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

**Step 9: Update Providers to include Redux**

```typescript
// app/src/components/Providers.tsx
'use client'

import { Provider } from 'react-redux'
import { store } from '@/store'
import { AuthProvider } from '@/contexts/AuthContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthProvider>{children}</AuthProvider>
    </Provider>
  )
}
```

**Step 10: Verify build**

```bash
npm run build
```

**Step 11: Commit**

```bash
git add -A && git commit -m "feat: add Redux store with all feature slices"
```

---

### Task 8: Layout shell (AppShell, TopBar, Sidebar)

**Files:**
- Create: `app/src/components/layout/AppShell.tsx`
- Create: `app/src/components/layout/TopBar.tsx`
- Create: `app/src/components/layout/Sidebar.tsx`
- Modify: `app/src/app/page.tsx`

**Step 1: Create Sidebar**

```typescript
// app/src/components/layout/Sidebar.tsx
'use client'

import { LayoutDashboard, MessageSquare, Users, Store, GitBranch, FlaskConical } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import { NavView } from '@/types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const navItems: { view: NavView; icon: typeof LayoutDashboard; label: string; href: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { view: 'chat', icon: MessageSquare, label: 'Chat', href: '/chat' },
  { view: 'customers', icon: Users, label: 'Customers', href: '/customers' },
  { view: 'wholesale', icon: Store, label: 'Wholesale', href: '/wholesale' },
  { view: 'branches', icon: GitBranch, label: 'Branches', href: '/branches' },
  { view: 'analytics', icon: FlaskConical, label: 'Analytics', href: '/analytics' },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const activeView = useAppSelector(s => s.nav.activeView)
  const router = useRouter()

  return (
    <nav className="w-16 border-r border-border bg-white flex flex-col items-center pt-4 gap-1">
      {navItems.map(({ view, icon: Icon, label, href }) => (
        <button
          key={view}
          onClick={() => {
            dispatch(setActiveView(view))
            router.push(href)
          }}
          className={cn(
            'w-12 h-12 flex flex-col items-center justify-center rounded-lg text-xs gap-0.5 transition-colors',
            activeView === view
              ? 'bg-secondary/10 text-secondary font-medium'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
```

**Step 2: Create TopBar**

```typescript
// app/src/components/layout/TopBar.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-4">
      <h1 className="text-sm font-semibold text-primary">Data Intelligence</h1>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm text-muted-foreground">{user.username}</span>
            {user.profilePic && (
              <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full" />
            )}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
```

**Step 3: Create AppShell**

```typescript
// app/src/components/layout/AppShell.tsx
'use client'

import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 4: Update main page to use AppShell**

```typescript
// app/src/app/page.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <AppShell>
      <div className="p-6">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Insight cards will appear here.</p>
      </div>
    </AppShell>
  )
}
```

**Step 5: Create stub pages for all routes**

Create placeholder pages for each route so navigation works:

```typescript
// app/src/app/chat/page.tsx
'use client'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'

export default function ChatPage() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>
  if (!user) return <LoginPage />
  return <AppShell><div className="p-6"><h2 className="text-xl font-semibold">Chat</h2></div></AppShell>
}
```

Create identical stub files for:
- `app/src/app/customers/page.tsx` (title: "Customers")
- `app/src/app/customers/[id]/page.tsx` (title: "Customer Profile")
- `app/src/app/wholesale/page.tsx` (title: "Wholesale Health")
- `app/src/app/branches/page.tsx` (title: "Branch Comparison")
- `app/src/app/analytics/page.tsx` (title: "Analytics")

**Step 6: Verify navigation**

```bash
npm run dev
```

Visit localhost:3000. Sidebar should render with all 6 nav items. Clicking each should navigate to the stub page.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add AppShell layout with sidebar navigation and stub pages"
```

---

## Phase 4: Database Schema + Connection

### Task 9: Drizzle schema + Supabase connection

**Files:**
- Create: `app/src/db/schema.ts`
- Create: `app/src/db/index.ts`
- Create: `app/drizzle.config.ts`

**Step 1: Create Drizzle schema**

Translate the full SQL schema to Drizzle ORM definitions:

```typescript
// app/src/db/schema.ts
import {
  pgTable, varchar, text, integer, decimal, boolean, date, timestamp, serial, bigserial, jsonb, index, unique,
} from 'drizzle-orm/pg-core'

// ============================================================
// CORE TABLES
// ============================================================

export const branches = pgTable('branches', {
  branch_id: varchar('branch_id', { length: 10 }).primaryKey(),
  branch_name: varchar('branch_name', { length: 100 }).notNull(),
  address: varchar('address', { length: 300 }),
  municipality: varchar('municipality', { length: 100 }).notNull(),
  province: varchar('province', { length: 100 }).notNull().default('Batangas'),
  opening_date: date('opening_date'),
  floor_area_sqm: integer('floor_area_sqm'),
  is_active: boolean('is_active').default(true),
})

export const products = pgTable('products', {
  product_id: varchar('product_id', { length: 20 }).primaryKey(),
  product_name: varchar('product_name', { length: 200 }).notNull(),
  brand: varchar('brand', { length: 100 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  subcategory: varchar('subcategory', { length: 100 }),
  department: varchar('department', { length: 50 }).notNull(),
  retail_price: decimal('retail_price', { precision: 8, scale: 2 }).notNull(),
  wholesale_price: decimal('wholesale_price', { precision: 8, scale: 2 }).notNull(),
  supplier: varchar('supplier', { length: 200 }),
  is_active: boolean('is_active').default(true),
})

export const customers = pgTable('customers', {
  customer_id: varchar('customer_id', { length: 20 }).primaryKey(),
  customer_type: varchar('customer_type', { length: 10 }).notNull(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 200 }),
  loyalty_card_number: varchar('loyalty_card_number', { length: 20 }),
  wholesale_member_id: varchar('wholesale_member_id', { length: 20 }),
  business_name: varchar('business_name', { length: 200 }),
  barangay: varchar('barangay', { length: 100 }),
  municipality: varchar('municipality', { length: 100 }),
  registration_date: date('registration_date').notNull(),
  credit_limit: decimal('credit_limit', { precision: 10, scale: 2 }),
  credit_terms_days: integer('credit_terms_days'),
  status: varchar('status', { length: 10 }).notNull().default('active'),
})

export const transactions = pgTable('transactions', {
  transaction_id: varchar('transaction_id', { length: 30 }).primaryKey(),
  customer_id: varchar('customer_id', { length: 20 }).references(() => customers.customer_id),
  branch_id: varchar('branch_id', { length: 10 }).notNull().references(() => branches.branch_id),
  transaction_date: timestamp('transaction_date').notNull(),
  transaction_type: varchar('transaction_type', { length: 10 }).notNull(),
  payment_method: varchar('payment_method', { length: 10 }).notNull(),
  total_amount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  items_count: integer('items_count').notNull(),
  loyalty_points_earned: integer('loyalty_points_earned').default(0),
}, (table) => [
  index('idx_transactions_customer').on(table.customer_id),
  index('idx_transactions_branch').on(table.branch_id),
  index('idx_transactions_date').on(table.transaction_date),
  index('idx_transactions_type').on(table.transaction_type),
])

export const transactionItems = pgTable('transaction_items', {
  item_id: bigserial('item_id', { mode: 'number' }).primaryKey(),
  transaction_id: varchar('transaction_id', { length: 30 }).notNull().references(() => transactions.transaction_id),
  product_id: varchar('product_id', { length: 20 }).notNull().references(() => products.product_id),
  quantity: integer('quantity').notNull(),
  unit_price: decimal('unit_price', { precision: 8, scale: 2 }).notNull(),
  line_total: decimal('line_total', { precision: 10, scale: 2 }).notNull(),
  is_wholesale_price: boolean('is_wholesale_price').default(false),
}, (table) => [
  index('idx_transaction_items_txn').on(table.transaction_id),
  index('idx_transaction_items_product').on(table.product_id),
])

export const wholesalePayments = pgTable('wholesale_payments', {
  payment_id: varchar('payment_id', { length: 20 }).primaryKey(),
  customer_id: varchar('customer_id', { length: 20 }).notNull().references(() => customers.customer_id),
  amount_paid: decimal('amount_paid', { precision: 10, scale: 2 }).notNull(),
  payment_date: date('payment_date').notNull(),
  days_overdue: integer('days_overdue').default(0),
  outstanding_balance: decimal('outstanding_balance', { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  index('idx_wholesale_payments_customer').on(table.customer_id),
])

// ============================================================
// ML OUTPUT TABLES
// ============================================================

export const customerSegments = pgTable('customer_segments', {
  customer_id: varchar('customer_id', { length: 20 }).primaryKey().references(() => customers.customer_id),
  segment_name: varchar('segment_name', { length: 50 }).notNull(),
  rfm_recency: integer('rfm_recency').notNull(),
  rfm_frequency: integer('rfm_frequency').notNull(),
  rfm_monetary: decimal('rfm_monetary', { precision: 10, scale: 2 }).notNull(),
  r_score: integer('r_score').notNull(),
  f_score: integer('f_score').notNull(),
  m_score: integer('m_score').notNull(),
  cluster_id: integer('cluster_id').notNull(),
  updated_at: timestamp('updated_at').defaultNow(),
})

export const churnScores = pgTable('churn_scores', {
  customer_id: varchar('customer_id', { length: 20 }).primaryKey().references(() => customers.customer_id),
  churn_probability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(),
  risk_level: varchar('risk_level', { length: 10 }).notNull(),
  days_since_last: integer('days_since_last').notNull(),
  frequency_change: decimal('frequency_change', { precision: 5, scale: 2 }),
  basket_change: decimal('basket_change', { precision: 5, scale: 2 }),
  top_risk_factor: varchar('top_risk_factor', { length: 100 }),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_churn_scores_risk').on(table.risk_level),
])

export const creditRiskScores = pgTable('credit_risk_scores', {
  customer_id: varchar('customer_id', { length: 20 }).primaryKey().references(() => customers.customer_id),
  risk_score: decimal('risk_score', { precision: 5, scale: 4 }).notNull(),
  risk_level: varchar('risk_level', { length: 10 }).notNull(),
  outstanding_balance: decimal('outstanding_balance', { precision: 10, scale: 2 }),
  credit_utilization: decimal('credit_utilization', { precision: 5, scale: 2 }),
  avg_days_overdue: decimal('avg_days_overdue', { precision: 5, scale: 1 }),
  payment_trend: varchar('payment_trend', { length: 20 }),
  top_risk_factor: varchar('top_risk_factor', { length: 100 }),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_credit_risk_scores_risk').on(table.risk_level),
])

export const productAssociations = pgTable('product_associations', {
  id: serial('id').primaryKey(),
  product_a_id: varchar('product_a_id', { length: 20 }).notNull().references(() => products.product_id),
  product_b_id: varchar('product_b_id', { length: 20 }).notNull().references(() => products.product_id),
  support: decimal('support', { precision: 6, scale: 4 }).notNull(),
  confidence_a_to_b: decimal('confidence_a_to_b', { precision: 6, scale: 4 }).notNull(),
  confidence_b_to_a: decimal('confidence_b_to_a', { precision: 6, scale: 4 }).notNull(),
  lift: decimal('lift', { precision: 8, scale: 4 }).notNull(),
  transaction_type: varchar('transaction_type', { length: 10 }).notNull(),
  branch_id: varchar('branch_id', { length: 10 }),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_product_associations_products').on(table.product_a_id, table.product_b_id),
  unique('uq_product_associations').on(table.product_a_id, table.product_b_id, table.transaction_type, table.branch_id),
])

export const demandForecasts = pgTable('demand_forecasts', {
  id: serial('id').primaryKey(),
  product_id: varchar('product_id', { length: 20 }).references(() => products.product_id),
  category: varchar('category', { length: 100 }),
  branch_id: varchar('branch_id', { length: 10 }).references(() => branches.branch_id),
  forecast_date: date('forecast_date').notNull(),
  predicted_quantity: decimal('predicted_quantity', { precision: 10, scale: 2 }).notNull(),
  lower_bound: decimal('lower_bound', { precision: 10, scale: 2 }),
  upper_bound: decimal('upper_bound', { precision: 10, scale: 2 }),
  based_on_period: varchar('based_on_period', { length: 20 }),
  updated_at: timestamp('updated_at').defaultNow(),
})

export const insightCards = pgTable('insight_cards', {
  id: serial('id').primaryKey(),
  severity: varchar('severity', { length: 15 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  action: text('action'),
  related_intent: varchar('related_intent', { length: 50 }),
  related_params: jsonb('related_params'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at'),
}, (table) => [
  index('idx_insight_cards_active').on(table.is_active, table.created_at),
])
```

**Step 2: Create database connection**

```typescript
// app/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
```

**Step 3: Create drizzle.config.ts**

```typescript
// app/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Step 4: Generate migration**

```bash
npx drizzle-kit generate
```

Expected: Migration files created in `src/db/migrations/`.

**Step 5: Push schema to Supabase (or run migration)**

```bash
npx drizzle-kit push
```

Expected: Tables created in Supabase. Verify via Supabase dashboard.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Drizzle schema and Supabase connection"
```

---

## Phase 5: Seed Script

### Task 10: Synthetic data seed script

**Files:**
- Create: `app/scripts/seed.ts`

This is the largest single file. It generates all synthetic data per the spec. The seed script should be runnable via `npx tsx scripts/seed.ts`.

**Step 1: Create the seed script**

The seed script must generate:
1. 7 branches (hardcoded data from spec)
2. 200-300 products (Filipino FMCG brands from spec, with realistic prices)
3. 500 retail + 80 wholesale + 15-20 dual customers (Filipino names, Batangas-region addresses)
4. 60,000-80,000 transactions with 200,000-300,000 line items (6 months, with all 10 embedded patterns from spec)
5. Wholesale payment records
6. Pre-computed ML output data (segments, churn scores, credit risk scores, product associations, demand forecasts, insight cards)

The script structure:

```typescript
// app/scripts/seed.ts
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

// ---- Branch data (hardcoded from spec) ----
const BRANCHES = [
  { branch_id: 'BAYMALL', branch_name: 'Citimart Baymall', municipality: 'Batangas City', province: 'Batangas', opening_date: '1986-06-06', floor_area_sqm: 2500 },
  { branch_id: 'PLAZA', branch_name: 'Citimart Plaza', municipality: 'Batangas City', province: 'Batangas', opening_date: '1992-03-15', floor_area_sqm: 2000 },
  { branch_id: 'SHOPON', branch_name: 'Citimart Shop-On', municipality: 'Batangas City', province: 'Batangas', opening_date: '2005-11-20', floor_area_sqm: 1800 },
  { branch_id: 'BAUAN', branch_name: 'Citimart Bauan', municipality: 'Bauan', province: 'Batangas', opening_date: '1998-07-10', floor_area_sqm: 1500 },
  { branch_id: 'LEMERY', branch_name: 'Citimart Lemery', municipality: 'Lemery', province: 'Batangas', opening_date: '2010-01-22', floor_area_sqm: 1600 },
  { branch_id: 'TANAUAN', branch_name: 'Citimart Tanauan', municipality: 'Tanauan', province: 'Batangas', opening_date: '2015-08-08', floor_area_sqm: 2200 },
  { branch_id: 'CALAPAN', branch_name: 'Citimart Island Mall', municipality: 'Calapan City', province: 'Oriental Mindoro', opening_date: '2008-04-05', floor_area_sqm: 1400 },
]

// ---- Product catalog (200-300 SKUs) ----
// Build products array following the spec's category structure with real Filipino FMCG brands.
// Each product: { product_id, product_name, brand, category, subcategory, department, retail_price, wholesale_price, supplier }
// Use the exact brands listed in the spec (Lucky Me, Century Tuna, Datu Puti, Nescafé, Bear Brand, etc.)
// Wholesale price = retail_price * (0.85 to 0.92) — 8-15% discount

// ---- Customer generation ----
// Filipino names common in Batangas per spec.
// 500 retail (LC-XXXXX loyalty cards), 80 wholesale (WM-XXXXX member IDs), 15-20 dual.
// Dual customers: same phone number, different customer_ids for retail vs wholesale.

// ---- Transaction generation ----
// 6 months of history. Date range: 2025-09-01 to 2026-03-01.
// Embed all 10 patterns from the spec.
// Use weighted random selection for products, branches, times.

// ---- Wholesale payment generation ----
// For all wholesale credit customers.

// ---- Pre-compute ML output tables ----
// Since this is a demo with synthetic data, pre-compute reasonable ML outputs:
// - customer_segments: assign segments based on generated transaction patterns
// - churn_scores: flag the customers we intentionally made churn-like
// - credit_risk_scores: flag the customers with overdue payment patterns
// - product_associations: hardcode the key associations from the spec patterns
// - insight_cards: generate 6-8 initial insight cards
// - demand_forecasts: generate 30-day forecasts for top categories

async function seed() {
  console.log('Starting seed...')

  // Clear existing data (in reverse FK order)
  await sql`TRUNCATE insight_cards, demand_forecasts, product_associations, credit_risk_scores, churn_scores, customer_segments, wholesale_payments, transaction_items, transactions, customers, products, branches CASCADE`

  // 1. Insert branches
  // 2. Insert products
  // 3. Insert customers
  // 4. Insert transactions + transaction_items
  // 5. Insert wholesale_payments
  // 6. Insert ML output tables

  console.log('Seed complete!')
  await sql.end()
}

seed().catch(console.error)
```

**Implementation note:** The full seed script will be 600-1000 lines. The implementing engineer should follow the spec's data requirements exactly. Key implementation details:

- **Products:** Build the product array with all brands from the spec organized by department/category. Use `PROD-001` through `PROD-300` for IDs. Set realistic Philippine peso prices.
- **Customers:** Use arrays of common Filipino first names and the surnames from the spec. Generate phone numbers in `09XX-XXX-XXXX` format. Distribute across municipalities.
- **Transactions:** Generate date-by-date for 6 months. For each day, determine transaction count based on day-of-week (weekends higher for retail, Tue/Wed higher for wholesale) and seasonal modifiers (Christmas spike, payday bumps on 15th/30th). For each transaction, randomly select a branch (weighted by floor area), customer (40% linked for retail, 100% for wholesale), payment method, and items.
- **Embedded patterns:** Deliberately inject the 10 patterns listed in the spec by biasing product co-occurrence, branch-specific category weights, declining frequency for specific Lemery buyers, overdue payments for specific buyers, etc.
- **ML outputs:** Pre-compute segment assignments, churn scores, credit risk scores, and product associations based on the patterns embedded in the transaction data. This ensures the demo works immediately without needing to run Lambda first.

**Step 2: Run seed**

```bash
cd app && npx tsx scripts/seed.ts
```

Expected: All tables populated. Verify counts in Supabase dashboard.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add synthetic data seed script"
```

---

## Phase 6: API Routes

### Task 11: Insights API route

**Files:**
- Create: `app/src/app/api/insights/route.ts`

**Step 1: Create insights route**

```typescript
// app/src/app/api/insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { insightCards } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest) => {
  const cards = await db
    .select()
    .from(insightCards)
    .where(eq(insightCards.is_active, true))
    .orderBy(desc(insightCards.created_at))

  return NextResponse.json({ insights: cards })
})
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add insights API route"
```

---

### Task 12: Customers API routes

**Files:**
- Create: `app/src/app/api/customers/route.ts`
- Create: `app/src/app/api/customers/[id]/route.ts`

**Step 1: Create customer list route**

```typescript
// app/src/app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { customers, customerSegments, churnScores, transactions } from '@/db/schema'
import { eq, sql, like, and } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'all'
  const segment = searchParams.get('segment') || ''
  const search = searchParams.get('search') || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Build query with joins to segments, churn scores, and transaction aggregates
  // Filter by type, segment, search (name/business)
  // Return CustomerSummary[] with pagination

  const results = await db.execute(sql`
    SELECT
      c.customer_id, c.customer_type, c.first_name, c.last_name, c.business_name,
      cs.segment_name,
      ch.risk_level as churn_risk,
      COALESCE(t.total_spend, 0) as total_spend,
      COALESCE(t.tx_count, 0) as transaction_count,
      t.last_date as last_transaction_date
    FROM customers c
    LEFT JOIN customer_segments cs ON c.customer_id = cs.customer_id
    LEFT JOIN churn_scores ch ON c.customer_id = ch.customer_id
    LEFT JOIN (
      SELECT customer_id, SUM(total_amount::numeric) as total_spend, COUNT(*) as tx_count, MAX(transaction_date) as last_date
      FROM transactions
      GROUP BY customer_id
    ) t ON c.customer_id = t.customer_id
    WHERE 1=1
    ${type !== 'all' ? sql`AND c.customer_type = ${type}` : sql``}
    ${segment ? sql`AND cs.segment_name = ${segment}` : sql``}
    ${search ? sql`AND (c.first_name ILIKE ${'%' + search + '%'} OR c.last_name ILIKE ${'%' + search + '%'} OR c.business_name ILIKE ${'%' + search + '%'})` : sql``}
    ORDER BY total_spend DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  return NextResponse.json({ customers: results })
})
```

**Step 2: Create customer profile route**

```typescript
// app/src/app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const GET = withAuth(async (
  request: NextRequest,
  _user,
) => {
  const id = request.url.split('/customers/')[1]?.split('?')[0]

  // Query 1: Basic customer info + segments + churn + credit risk
  // Query 2: Top categories by spend
  // Query 3: Top brands by frequency
  // Query 4: Monthly spend trend (last 6 months)
  // Query 5: Recent transactions (last 20)
  // Query 6: Recommended products from product_associations

  // Execute all queries in parallel, merge results into CustomerProfile

  const [customerData] = await db.execute(sql`
    SELECT
      c.*,
      cs.segment_name, cs.rfm_recency, cs.rfm_frequency, cs.rfm_monetary,
      ch.churn_probability, ch.risk_level as churn_risk, ch.top_risk_factor,
      cr.risk_level as credit_risk_level, cr.credit_utilization, cr.outstanding_balance
    FROM customers c
    LEFT JOIN customer_segments cs ON c.customer_id = cs.customer_id
    LEFT JOIN churn_scores ch ON c.customer_id = ch.customer_id
    LEFT JOIN credit_risk_scores cr ON c.customer_id = cr.customer_id
    WHERE c.customer_id = ${id}
  `)

  if (!customerData) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Run additional queries in parallel
  const [topCategories, topBrands, monthlySpend, recentTx, recommendations] = await Promise.all([
    db.execute(sql`
      SELECT p.category, SUM(ti.line_total::numeric) as total
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.transaction_id
      JOIN products p ON ti.product_id = p.product_id
      WHERE t.customer_id = ${id}
      GROUP BY p.category ORDER BY total DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT p.brand, COUNT(*) as count
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.transaction_id
      JOIN products p ON ti.product_id = p.product_id
      WHERE t.customer_id = ${id}
      GROUP BY p.brand ORDER BY count DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT TO_CHAR(t.transaction_date, 'YYYY-MM') as month, SUM(t.total_amount::numeric) as total
      FROM transactions t
      WHERE t.customer_id = ${id}
      GROUP BY month ORDER BY month
    `),
    db.execute(sql`
      SELECT t.transaction_id, t.transaction_date as date, b.branch_name, t.transaction_type, t.total_amount, t.items_count
      FROM transactions t JOIN branches b ON t.branch_id = b.branch_id
      WHERE t.customer_id = ${id}
      ORDER BY t.transaction_date DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT p.product_name, pa.confidence_a_to_b as confidence
      FROM product_associations pa
      JOIN products p ON pa.product_b_id = p.product_id
      WHERE pa.product_a_id IN (
        SELECT DISTINCT ti.product_id FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.transaction_id
        WHERE t.customer_id = ${id}
      )
      ORDER BY pa.lift DESC LIMIT 10
    `),
  ])

  return NextResponse.json({
    customer: {
      ...customerData,
      top_categories: topCategories,
      top_brands: topBrands,
      monthly_spend: monthlySpend,
      recent_transactions: recentTx,
      recommended_products: recommendations,
    },
  })
})
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add customer list and profile API routes"
```

---

### Task 13: Wholesale + Branches + KPI API routes

**Files:**
- Create: `app/src/app/api/wholesale/route.ts`
- Create: `app/src/app/api/branches/route.ts`
- Create: `app/src/app/api/kpi/route.ts`

**Step 1: Create wholesale route**

Query wholesale buyers joined with credit_risk_scores, recent transaction aggregates, and monthly totals. Support filters for branch, risk level, sort. Return `WholesaleBuyer[]`.

**Step 2: Create branches route**

Query branch comparison data: revenue this month vs last month, transaction count, avg basket size, retail vs wholesale split, top categories per branch. Return `BranchData[]`.

**Step 3: Create KPI route**

Query 4 dashboard KPIs: total revenue this month (vs last month with % change), active customers, wholesale credit outstanding (% overdue), top branch by revenue.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add wholesale, branches, and KPI API routes"
```

---

## Phase 7: Gemini Chat Integration

### Task 14: Gemini client + system prompts

**Files:**
- Create: `app/src/lib/gemini.ts`
- Create: `app/src/lib/intents/system-prompt.ts`
- Create: `app/src/lib/intents/formatting-prompt.ts`

**Step 1: Create Gemini client**

```typescript
// app/src/lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function classifyIntent(userQuestion: string, currentDate: string) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  })

  const { SYSTEM_PROMPT } = await import('./intents/system-prompt')

  const result = await model.generateContent({
    systemInstruction: SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: `Current date: ${currentDate}\nUser question: ${userQuestion}` }] }],
  })

  return JSON.parse(result.response.text())
}

export async function formatResponse(userQuestion: string, queryResults: unknown) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  })

  const { FORMATTING_PROMPT } = await import('./intents/formatting-prompt')

  const result = await model.generateContent({
    systemInstruction: FORMATTING_PROMPT,
    contents: [{ role: 'user', parts: [{ text: `Original question: ${userQuestion}\nQuery results: ${JSON.stringify(queryResults)}\nFormat this into a business-friendly response with chart configuration.` }] }],
  })

  return JSON.parse(result.response.text())
}
```

**Step 2: Create system prompt for intent classification**

The system prompt should define all 12+ intents with their parameters and expected JSON output format. Follow the spec's intent list.

**Step 3: Create formatting prompt**

The formatting prompt instructs Gemini to output `{ answer_text, chart_type, chart_config, follow_up_suggestions }`.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Gemini client and intent/formatting prompts"
```

---

### Task 15: Intent → query mapping + chat API route

**Files:**
- Create: `app/src/lib/intents/queries.ts`
- Create: `app/src/app/api/chat/route.ts`

**Step 1: Create intent query map**

Each intent maps to a function that takes params and returns a Drizzle/SQL query. Implement all intents from the spec: `top_products`, `customer_purchase_trend`, `basket_analysis`, `wholesale_buyer_health`, `branch_comparison`, `customer_segmentation`, `churn_risk`, `price_sensitivity`, `seasonal_forecast`, `customer_profile`, `credit_risk`, `promo_impact`, `general_insight`.

**Step 2: Create chat API route**

```typescript
// app/src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { classifyIntent, formatResponse } from '@/lib/gemini'
import { executeIntent } from '@/lib/intents/queries'

export const POST = withAuth(async (request: NextRequest) => {
  const { question } = await request.json()
  const currentDate = new Date().toISOString().split('T')[0]

  // Step 1: Classify intent
  const intent = await classifyIntent(question, currentDate)

  // Step 2: Execute query
  const queryResults = await executeIntent(intent.intent, intent.parameters)

  // Step 3: Format response
  const formatted = await formatResponse(question, queryResults)

  return NextResponse.json({
    answer_text: formatted.answer_text,
    chart_config: formatted.chart_config || null,
    follow_up_suggestions: formatted.follow_up_suggestions || [],
  })
})
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add chat API route with Gemini two-call pattern"
```

---

## Phase 8: Frontend Pages

### Task 16: Dashboard page

**Files:**
- Create: `app/src/components/dashboard/KPICard.tsx`
- Create: `app/src/components/dashboard/InsightCard.tsx`
- Modify: `app/src/app/page.tsx`

Implement the dashboard with:
- 4 KPI cards across the top (revenue, active customers, credit outstanding, top branch)
- Grid of insight cards below, ordered by severity
- Each insight card has severity indicator, title, body, action, and "Dig Deeper" button
- Fetch data from `/api/kpi` and `/api/insights` on mount

**Commit:** `git commit -m "feat: implement dashboard with KPI cards and insight cards"`

---

### Task 17: Chat page

**Files:**
- Create: `app/src/components/chat/ChatThread.tsx`
- Create: `app/src/components/chat/ChatInput.tsx`
- Create: `app/src/components/chat/ChartPanel.tsx`
- Create: `app/src/components/chat/StarterQuestions.tsx`
- Modify: `app/src/app/chat/page.tsx`

Implement the two-column chat interface:
- Left (60%): Chat thread with message bubbles, thinking indicator, follow-up suggestion chips
- Right (40%): Chart panel rendering Recharts based on `chartConfig`
- Starter questions shown when chat is empty
- Chat input at bottom with send button
- Dispatches to Redux `chatSlice`
- Uses `apiFetch` to call `/api/chat`

**Commit:** `git commit -m "feat: implement conversational BI chat interface"`

---

### Task 18: Customer list + DNA view pages

**Files:**
- Create: `app/src/components/customers/CustomerList.tsx`
- Create: `app/src/components/customers/CustomerDNA.tsx`
- Modify: `app/src/app/customers/page.tsx`
- Modify: `app/src/app/customers/[id]/page.tsx`

Customer list: filterable table with segment badges, churn risk indicators. Click navigates to DNA view.

Customer DNA view: Profile header, tabbed sections (Overview, Purchase Behavior with charts, Basket Patterns, Timeline). For "both" type customers, show dual identity prominently.

**Commit:** `git commit -m "feat: implement customer list and DNA view pages"`

---

### Task 19: Wholesale health monitor page

**Files:**
- Create: `app/src/components/wholesale/BuyerCard.tsx`
- Create: `app/src/components/wholesale/RiskIndicator.tsx`
- Modify: `app/src/app/wholesale/page.tsx`

Filterable card/table view of wholesale buyers with risk indicators, credit utilization progress bars, trend arrows, expandable detail with monthly chart.

**Commit:** `git commit -m "feat: implement wholesale buyer health monitor"`

---

### Task 20: Branch comparison page

**Files:**
- Create: `app/src/components/branches/BranchCharts.tsx`
- Modify: `app/src/app/branches/page.tsx`

Multi-chart comparison: revenue bar chart, revenue trend line chart, retail/wholesale stacked bars, avg basket size, top categories, Calapan callout note.

**Commit:** `git commit -m "feat: implement branch comparison dashboard"`

---

### Task 21: Analytics (ML trigger) page

**Files:**
- Create: `app/src/components/analytics/AnalysisCard.tsx`
- Create: `app/src/lib/lambda.ts`
- Create: `app/src/app/api/ml/trigger/route.ts`
- Modify: `app/src/app/analytics/page.tsx`

Lambda client:
```typescript
// app/src/lib/lambda.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function invokeLambda(payload: Record<string, unknown>) {
  const command = new InvokeCommand({
    FunctionName: process.env.LAMBDA_FUNCTION_NAME!,
    Payload: JSON.stringify(payload),
    InvocationType: 'RequestResponse',
  })

  const response = await lambda.send(command)
  return JSON.parse(Buffer.from(response.Payload!).toString())
}
```

Analytics page: 5 analysis cards (basket, segmentation, churn, credit risk, demand forecast) each with parameter inputs, run button, last run info, loading state.

**Commit:** `git commit -m "feat: implement analytics page with Lambda ML triggers"`

---

## Phase 9: Insight Generation Cron

### Task 22: Cron route for insight refresh

**Files:**
- Create: `app/src/app/api/cron/refresh-insights/route.ts`
- Create: `app/vercel.json` (cron config)

The cron route:
1. Runs analytical queries (week-over-week comparisons, overdue credit, churn counts, branch deltas)
2. Passes aggregated results to Gemini requesting 5-8 insight cards
3. Deactivates old cards, writes new ones to `insight_cards` table

```json
// app/vercel.json
{
  "crons": [
    {
      "path": "/api/cron/refresh-insights",
      "schedule": "0 22 * * *"
    }
  ]
}
```

**Commit:** `git commit -m "feat: add insight refresh cron job"`

---

## Phase 10: ML Pipeline (Python)

### Task 23: Lambda handler + Dockerfile

**Files:**
- Create: `ml_pipeline/Dockerfile`
- Create: `ml_pipeline/requirements.txt`
- Create: `ml_pipeline/lambda_handler.py`

Follow the spec exactly for Dockerfile, requirements, and handler structure.

**Commit:** `git commit -m "feat: add Lambda handler and Dockerfile for ML pipeline"`

---

### Task 24: Basket analysis module

**Files:**
- Create: `ml_pipeline/ml_pipeline/__init__.py`
- Create: `ml_pipeline/ml_pipeline/basket_analysis.py`
- Create: `ml_pipeline/ml_pipeline/db.py` (shared DB connection helper)

FP-Growth via mlxtend. min_support=0.02, min_lift=1.5, confidence >= 0.25. Writes to `product_associations` table.

**Commit:** `git commit -m "feat: add FP-Growth basket analysis ML module"`

---

### Task 25: Segmentation module

**Files:**
- Create: `ml_pipeline/ml_pipeline/segmentation.py`

RFM scoring + K-Means (k=5). Label clusters per spec. Writes to `customer_segments` table.

**Commit:** `git commit -m "feat: add RFM + K-Means customer segmentation module"`

---

### Task 26: Churn scoring module

**Files:**
- Create: `ml_pipeline/ml_pipeline/churn_scoring.py`

Logistic Regression on transaction behavior features. Writes to `churn_scores` table.

**Commit:** `git commit -m "feat: add logistic regression churn scoring module"`

---

### Task 27: Credit risk module

**Files:**
- Create: `ml_pipeline/ml_pipeline/credit_risk.py`

Logistic Regression on payment history features. Writes to `credit_risk_scores` table.

**Commit:** `git commit -m "feat: add credit risk scoring module"`

---

### Task 28: Demand forecast module

**Files:**
- Create: `ml_pipeline/ml_pipeline/demand_forecast.py`

Prophet with Philippine holiday calendar. Forecasts next 30 days for top products/categories. Writes to `demand_forecasts` table.

**Commit:** `git commit -m "feat: add Prophet demand forecasting module"`

---

## Phase 11: Integration Testing & Polish

### Task 29: End-to-end verification

**Steps:**
1. Ensure seed script runs successfully and populates all tables
2. Verify all API routes return correct data
3. Test login flow with Firebase
4. Test chat with sample questions from the spec
5. Test navigation between all pages
6. Verify charts render correctly
7. Test wholesale health filters
8. Test customer DNA view for a "both" type customer
9. Verify responsive layout on mobile viewport

**Commit:** Any fixes as separate commits.

---

### Task 30: Loading states + empty states

**Steps:**
1. Add meaningful loading messages per the spec ("Asking your data about wholesale trends...")
2. Add empty state messages ("No wholesale buyers in Lemery are currently flagged as high risk.")
3. Verify all data fetches show loading indicators

**Commit:** `git commit -m "feat: add loading states and empty states throughout"`

---

## Execution Notes

- **Environment setup required before Task 9:** User must create Supabase database, Firebase project, and set up `.env.local` with all required variables.
- **AWS setup required before Task 23:** User must have AWS account with ECR, Lambda, and EventBridge configured.
- **Task 10 (seed script) is the most complex single task** — expect 600-1000 lines of code. Consider splitting into sub-modules if needed.
- **Tasks 16-21 (frontend pages) are the most visible** — these are what the Go family sees. Invest in polish here.
- **The ML pipeline (Tasks 23-28) can be developed independently** of the frontend after the schema and seed data are in place.
