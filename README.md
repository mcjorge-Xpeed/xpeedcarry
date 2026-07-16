# GamePro — Plataforma de órdenes de gaming

MVP funcional: catálogo de juegos, órdenes personalizadas, pago con Stripe,
chat de soporte, chat cliente-pro y panel de administración (clientes, pros,
órdenes, control de pago a 7 días).

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **New project**.
2. Cuando esté listo, entra a **SQL Editor** → pega TODO el contenido de
   `supabase/schema.sql` → **Run**. Esto crea las tablas, la seguridad (RLS)
   y algunos juegos de ejemplo.
3. Ve a **Project Settings > API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secreta, no la expongas) → `SUPABASE_SERVICE_ROLE_KEY`
4. En **Authentication > Providers**, deja habilitado "Email" (usamos login
   por link mágico, sin contraseña, para simplificar).

### Convertir un usuario en "pro" o "admin"
Por defecto todo el que se registra es `client`. Para volver a alguien
`pro` o `admin`, ve a **Table editor > profiles** en Supabase y cambia
manualmente el campo `role` de ese usuario. Puedes hacer esto también desde
el panel admin más adelante si quieres agregar esa función.

## 2. Crear la cuenta de Stripe

1. Ve a https://dashboard.stripe.com/register y crea tu cuenta (esta es tu
   "cuenta concentrada" — todos los pagos de clientes caen aquí).
2. Mientras activas la cuenta puedes trabajar en **modo prueba** (test mode).
3. Ve a **Developers > API keys** y copia la **Secret key** →
   `STRIPE_SECRET_KEY`.
4. Para el webhook (necesario para que las órdenes se marquen "pagadas"
   automáticamente):
   - En local: instala Stripe CLI y corre
     `stripe listen --forward-to localhost:3000/api/stripe/webhook`
     Te dará un `whsec_...` → ponlo en `STRIPE_WEBHOOK_SECRET`.
   - En producción (Vercel): ve a **Developers > Webhooks > Add endpoint**,
     usa `https://tu-dominio.vercel.app/api/stripe/webhook`, selecciona el
     evento `checkout.session.completed`, y copia el `whsec_...` que te da.

## 3. Configurar variables de entorno

Copia `.env.local.example` a `.env.local` y llena los valores:

```bash
cp .env.local.example .env.local
```

## 4. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## 5. Subir a GitHub y desplegar en Vercel

```bash
git init
git add .
git commit -m "Primera versión de GamePro"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

Luego en Vercel:
1. **Add New Project** → importa el repo.
2. En **Environment Variables**, pega las mismas variables de tu `.env.local`
   (usa las claves reales de Stripe en modo "live" cuando estés listo para
   cobrar de verdad).
3. Deploy.
4. No olvides crear el webhook de Stripe apuntando a tu dominio de Vercel
   (paso 2 de arriba) y actualizar `STRIPE_WEBHOOK_SECRET` en Vercel.

## Cómo funciona el flujo de pago a 7 días

- Cuando un cliente paga, el webhook de Stripe marca la orden como `paid`.
- Un trigger en la base de datos calcula automáticamente
  `pro_payout_due_at = fecha de pago + 7 días`.
- Tú (admin) asignas un pro a la orden desde `/admin/orders/[id]`.
- Cuando el trabajo está listo, marcas la orden como `completed`.
- El panel admin te avisa (en amarillo) cuando ya se cumplieron los 7 días
  y puedes pagarle al pro.
- Le pagas manualmente desde tu cuenta de Stripe/banco (transferencia,
  Stripe payout, PayPal, lo que uses) y luego presionas
  **"Marcar como pagado al pro"** para dejarlo registrado.

> Elegiste pagos manuales, así que el dinero de Stripe se queda en tu
> cuenta concentrada hasta que tú decidas transferirlo — no hay reparto
> automático (eso sería Stripe Connect, que puedes agregar después si
> escalas y quieres automatizar los pagos a muchos pros).

## Roles

- **client**: crea órdenes, paga, chatea con soporte y con su pro asignado.
- **pro**: ve las órdenes que le asignes y chatea con el cliente.
- **admin**: ve todo — clientes, pros, órdenes, chats — y controla el flujo
  de pagos.

## Lo que falta / próximos pasos sugeridos

- Panel para que el "pro" vea sus propias órdenes asignadas (hoy solo el
  admin asigna desde `/admin`; se puede agregar `/pro` fácilmente).
- Subida de comprobantes/capturas en el chat.
- Notificaciones por correo (Supabase tiene esto integrado, o Resend).
- Revisar bien las políticas de RLS en `schema.sql` antes de manejar pagos
  reales — están pensadas como punto de partida sólido, no como auditoría
  de seguridad final.
