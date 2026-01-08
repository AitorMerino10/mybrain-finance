# Control de Gastos Familiar - Aitor & Familia

Aplicación web para la gestión y control de gastos familiares, desarrollada con Next.js 14 y Supabase.

## 📋 Descripción

Sistema de gestión de gastos diseñado para ayudar a Aitor y su familia a llevar un control detallado de sus finanzas personales. La aplicación permite registrar, categorizar y analizar gastos de manera intuitiva.

**⚠️ IMPORTANTE - Diseño Móvil-First**: Esta aplicación está diseñada con un enfoque **móvil-first**. El diseño y la experiencia de usuario están optimizados principalmente para dispositivos móviles, ya que la introducción de transacciones se realizará principalmente desde el móvil. Todos los componentes, formularios y modales deben verse y funcionar perfectamente en pantallas pequeñas, con la misma calidad que en ordenadores.

## 🏗️ Arquitectura

### Stack Tecnológico

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Base de Datos**: Supabase (PostgreSQL)
- **Cliente de Base de Datos**: @supabase/supabase-js

### Arquitectura de la Aplicación

La aplicación utiliza el **App Router** de Next.js 14, que proporciona:

- **Server Components por defecto**: Componentes renderizados en el servidor para mejor rendimiento
- **Rutas basadas en archivos**: La estructura de carpetas en `app/` define las rutas de la aplicación
- **Layouts anidados**: Sistema de layouts para compartir UI entre rutas
- **Streaming y Suspense**: Carga progresiva de contenido

### Flujo de Datos

```
Usuario → Componente React → Cliente Supabase → Supabase (PostgreSQL)
                ↓
         Estado Local (React)
                ↓
         UI Actualizada
```

## 📦 Paquetes y Dependencias

### Dependencias de Producción

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `next` | ^14 | Framework React con SSR y optimizaciones |
| `react` | ^18 | Biblioteca para construir interfaces de usuario |
| `react-dom` | ^18 | Renderizado de React en el DOM |
| `@supabase/supabase-js` | ^2.89.0 | Cliente JavaScript para interactuar con Supabase |

### Dependencias de Desarrollo

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `typescript` | ^5 | Superset de JavaScript con tipado estático |
| `@types/node` | ^20 | Tipos TypeScript para Node.js |
| `@types/react` | ^18 | Tipos TypeScript para React |
| `@types/react-dom` | ^18 | Tipos TypeScript para React DOM |
| `tailwindcss` | ^3.3.0 | Framework CSS utility-first |
| `autoprefixer` | ^10.0.1 | Plugin PostCSS para añadir prefijos de navegadores |
| `postcss` | ^8 | Herramienta para transformar CSS con plugins |
| `eslint` | ^8 | Linter para JavaScript/TypeScript |
| `eslint-config-next` | ^14 | Configuración ESLint para Next.js |

## 📁 Estructura de Carpetas

```
proyecto-gestion-gastos/
│
├── app/                      # Directorio principal de la aplicación (App Router)
│   ├── layout.tsx           # Layout raíz de la aplicación
│   ├── page.tsx             # Página principal (ruta "/")
│   ├── globals.css          # Estilos globales con Tailwind CSS
│   └── test-connection/    # Página de prueba de conexión con Supabase
│       └── page.tsx         # Componente para probar la conexión
│
├── components/               # Componentes reutilizables de React
│   └── (vacía - pendiente de desarrollo)
│
├── lib/                     # Utilidades y funciones auxiliares
│   └── supabase.ts         # Cliente de Supabase configurado
│
├── types/                    # Definiciones de tipos TypeScript
│   └── (vacía - pendiente de desarrollo)
│
├── node_modules/            # Dependencias instaladas (ignorado en git)
│
├── .eslintrc.json          # Configuración de ESLint
├── .gitignore              # Archivos y carpetas ignorados por Git
├── next.config.mjs         # Configuración de Next.js
├── package.json            # Dependencias y scripts del proyecto
├── postcss.config.mjs     # Configuración de PostCSS
├── tailwind.config.ts      # Configuración de Tailwind CSS
└── tsconfig.json           # Configuración de TypeScript
```

### Descripción de Carpetas

- **`app/`**: Contiene las rutas y páginas de la aplicación usando el App Router de Next.js. Cada archivo/carpeta dentro de `app/` define una ruta.
- **`components/`**: Almacena componentes React reutilizables que pueden ser utilizados en múltiples páginas.
- **`lib/`**: Contiene funciones auxiliares, utilidades y configuraciones (como el cliente de Supabase).
- **`types/`**: Define tipos e interfaces TypeScript compartidos en toda la aplicación.

## 🔧 Configuración

### TypeScript

El proyecto está configurado con TypeScript en modo estricto (`strict: true`). La configuración incluye:

- **Path Aliases**: `@/*` apunta a la raíz del proyecto para imports absolutos
- **JSX**: Modo `preserve` para que Next.js procese el JSX
- **Module Resolution**: `bundler` para compatibilidad con Next.js

### Tailwind CSS

Configurado para escanear archivos en:
- `./pages/**/*.{js,ts,jsx,tsx,mdx}`
- `./components/**/*.{js,ts,jsx,tsx,mdx}`
- `./app/**/*.{js,ts,jsx,tsx,mdx}`

### Next.js

Configuración básica sin modificaciones especiales. Lista para expandir según necesidades del proyecto.

## 🚀 Scripts Disponibles

```bash
# Desarrollo: Inicia el servidor de desarrollo en http://localhost:3000
npm run dev

# Producción: Construye la aplicación para producción
npm run build

# Inicio: Inicia el servidor de producción (requiere build previo)
npm start

# Linting: Ejecuta ESLint para verificar errores de código
npm run lint
```

## 📝 Lógica de la Aplicación

### Estado Actual (v0.2.0)

La aplicación tiene configurada la conexión con Supabase y una página de prueba:

1. **Página Principal (`app/page.tsx`)**
   - Muestra un título de bienvenida: "Control de Gastos Familiar - Aitor & Familia"
   - Utiliza Tailwind CSS para estilos
   - Componente de servidor (Server Component)

2. **Layout Principal (`app/layout.tsx`)**
   - Define el HTML raíz con idioma español (`lang="es"`)
   - Incluye metadata para SEO
   - Importa estilos globales

3. **Estilos Globales (`app/globals.css`)**
   - Configuración de Tailwind CSS
   - Variables CSS para tema claro/oscuro
   - Estilos base del body

4. **Cliente de Supabase (`lib/supabase.ts`)**
   - Configuración del cliente de Supabase usando variables de entorno
   - Exporta instancia `supabase` para uso en toda la aplicación
   - Lee `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. **Página de Prueba de Conexión (`app/test-connection/page.tsx`)**
   - **Ruta**: `/test-connection`
   - **Tipo**: Client Component (usa `'use client'`)
   - **Funcionalidades**:
     - Muestra el conteo de registros en `pml_dim_transaction_type` al cargar
     - Botón para crear una familia de prueba en `pml_dim_family`
     - Manejo de estados de carga y mensajes de éxito/error
     - Interfaz con Tailwind CSS para feedback visual

### Próximas Funcionalidades (Pendientes)

- [x] Configuración de conexión con Supabase
- [ ] Sistema de autenticación
- [ ] CRUD de gastos
- [ ] Categorización de gastos
- [ ] Dashboard con estadísticas
- [ ] Filtros y búsqueda
- [ ] Exportación de datos

## 🔐 Variables de Entorno

El archivo `.env.local` debe contener las credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servicio_de_supabase
```

**Nota**: El archivo `.env.local` está incluido en `.gitignore` para proteger las credenciales.

**Importante sobre `SUPABASE_SERVICE_ROLE_KEY`**:
- Esta clave es necesaria para crear usuarios invitados desde el panel de administración
- Se encuentra en tu proyecto de Supabase: Settings → API → Service Role Key
- **NUNCA** expongas esta clave en el cliente. Solo se usa en API routes del servidor
- Es necesaria para la funcionalidad de "Añadir Miembro" en la página de Mi Cuenta

## 📚 Convenciones de Código

- **Nombres de archivos**: kebab-case para archivos, PascalCase para componentes
- **Imports**: Usar path aliases `@/` para imports absolutos
- **Componentes**: Server Components por defecto, Client Components solo cuando sea necesario
- **Tipos**: Definir tipos en `types/` para reutilización

## 🛠️ Próximos Pasos

1. ~~Configurar conexión con Supabase~~ ✅
2. Verificar conexión con página de prueba
3. Crear esquema de base de datos completo
4. Implementar autenticación
5. Desarrollar componentes de UI
6. Implementar lógica de negocio

## 🧪 Pruebas

Para verificar la conexión con Supabase, visita la ruta `/test-connection` en el navegador. Esta página permite:
- Verificar el conteo de registros en `pml_dim_transaction_type`
- Crear una familia de prueba en `pml_dim_family`

---

**Última actualización**: v0.2.0 - Configuración de Supabase y página de prueba de conexión

