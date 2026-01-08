# Project Context - Control de Gastos Familiar

**Única Fuente de Verdad** para cualquier IA que trabaje en este proyecto.

---

## 📊 Arquitectura de Base de Datos

### Nomenclatura de Tablas

El esquema de base de datos sigue una convención estricta basada en el modelo de datos dimensional (Data Warehouse):

#### **`pml_dim_*` - Tablas de Dimensiones**
Tablas que contienen datos descriptivos y de referencia. Ejemplos:
- `pml_dim_family` - Familias de usuarios
- `pml_dim_category` - Categorías de transacciones (ej: Alimentación, Transporte)
- `pml_dim_subcategory` - Subcategorías dentro de cada categoría
- `pml_dim_transaction_type` - Tipos de transacción (Income/Expense)
- `pml_dim_user` - Usuarios del sistema
- `pml_dim_tag` - Etiquetas para clasificar transacciones

**Características:**
- Contienen datos maestros y de referencia
- Generalmente tienen campos descriptivos (`ds_*`) y campos de identificación (`id_*`)
- Relaciones con otras tablas mediante claves foráneas

#### **`gnp_fct_*` - Tablas de Hechos (Fact Tables)**
Tablas que contienen eventos y transacciones medibles. Ejemplos:
- `gnp_fct_transactions` - Tabla principal de transacciones financieras

**Características:**
- Contienen métricas y eventos que ocurren en el tiempo
- Tienen campos numéricos medibles (`ft_*` para importes)
- Relacionadas con múltiples tablas de dimensiones mediante claves foráneas
- Representan el "qué pasó" del sistema

#### **`pml_rel_*` - Tablas de Relaciones (Junction Tables)**
Tablas que establecen relaciones muchos-a-muchos entre entidades. Ejemplos:
- `pml_rel_transaction_tag` - Relación entre transacciones y etiquetas
- `pml_rel_transaction_user` - Relación entre transacciones y usuarios (para transacciones compartidas)
- `pml_rel_user_family` - Relación entre usuarios y familias

**Características:**
- Solo contienen claves foráneas que relacionan dos o más tablas
- Permiten relaciones muchos-a-muchos
- No contienen datos descriptivos propios

#### **`pml_log_*` - Tablas de Auditoría y Logs**
Tablas que registran cambios y eventos del sistema. Ejemplos:
- `pml_log_transaction_changes` - Registro de cambios en transacciones

**Características:**
- Almacenan historial de cambios
- Utilizan JSONB para guardar estados completos (antes/después)
- Campos de auditoría (`dt_change`, `id_user`, `ds_change_type`)

---

## 🔤 Esquema Técnico - Prefijos de Campos

El proyecto utiliza una nomenclatura estricta para los nombres de columnas que permite identificar el tipo de dato y su propósito:

### **`id_*` - Identificadores**
- **Tipo**: `string` (UUIDs en PostgreSQL)
- **Propósito**: Claves primarias y foráneas
- **Ejemplos**: 
  - `id_family`, `id_transaction`, `id_category`, `id_user`
- **Regla**: Siempre UUIDs generados automáticamente, opcionales en `Insert` pero requeridos en `Row`

### **`ds_*` - Descripciones y Texto (Description/String)**
- **Tipo**: `string` o `string | null`
- **Propósito**: Campos de texto descriptivos
- **Ejemplos**:
  - `ds_family` - Nombre de la familia
  - `ds_category` - Nombre de la categoría
  - `ds_subcategory` - Nombre de la subcategoría
  - `ds_comments` - Comentarios en transacciones
  - `ds_month_declared` - Mes declarado (formato string)
  - `ds_change_type` - Tipo de cambio en logs
  - `ds_color` - Código de color (hex)
  - `ds_icon` - Nombre del icono

### **`dt_*` - Fechas y Timestamps (Date/Time)**
- **Tipo**: `string | null` (ISO 8601 format)
- **Propósito**: Fechas y marcas de tiempo
- **Ejemplos**:
  - `dt_created` - Fecha de creación (auto-generada)
  - `dt_updated` - Fecha de última actualización (auto-actualizada por triggers)
  - `dt_date` - Fecha de la transacción
  - `dt_change` - Fecha del cambio en logs

### **`ft_*` - Importes y Valores Numéricos (Float/Amount)**
- **Tipo**: `number`
- **Propósito**: Valores monetarios y numéricos medibles
- **Ejemplos**:
  - `ft_amount` - Importe de la transacción

### **`js_*` - Campos JSON/JSONB**
- **Tipo**: `Json | null` (JSONB en PostgreSQL)
- **Propósito**: Datos estructurados flexibles
- **Ejemplos**:
  - `js_old_data` - Estado anterior en formato JSON
  - `js_new_data` - Estado nuevo en formato JSON

### **`is_*` - Campos Booleanos**
- **Tipo**: `boolean | null`
- **Propósito**: Flags y valores booleanos
- **Ejemplos**:
  - `is_expense` - Indica si es un gasto
  - `is_income` - Indica si es un ingreso

### **`id_order` - Ordenamiento**
- **Tipo**: `number | null`
- **Propósito**: Orden de visualización/presentación
- **Ejemplo**: `id_order` en categorías para definir el orden de aparición

---

## 🔄 Lógica Especial del Sistema

### Sistema de Auditoría Automática

#### **Triggers de Actualización de `dt_updated`**
- **Comportamiento**: Todas las tablas con campo `dt_updated` tienen triggers de base de datos que automáticamente actualizan este campo cuando se modifica cualquier registro
- **Implementación**: A nivel de PostgreSQL/Supabase
- **Implicaciones**: 
  - No es necesario establecer `dt_updated` manualmente en las operaciones `Update`
  - El campo se actualiza automáticamente en cada modificación
  - `dt_created` se establece en la creación (también puede ser automático)

#### **Tabla de Logs: `pml_log_transaction_changes`**

Sistema de auditoría completo para transacciones que registra todos los cambios:

**Estructura:**
```typescript
{
  id_log: string                    // UUID del log
  id_transaction: string            // ID de la transacción modificada
  id_user: string | null            // Usuario que realizó el cambio
  dt_change: string | null          // Timestamp del cambio
  ds_change_type: string | null     // Tipo de cambio (INSERT, UPDATE, DELETE)
  js_old_data: Json | null          // Estado completo ANTES del cambio (JSONB)
  js_new_data: Json | null          // Estado completo DESPUÉS del cambio (JSONB)
}
```

**Características:**
- **JSONB para versionado completo**: Los campos `js_old_data` y `js_new_data` almacenan el estado completo de la transacción antes y después del cambio
- **Historial completo**: Permite reconstruir cualquier versión anterior de una transacción
- **Trazabilidad**: Registra quién (`id_user`), cuándo (`dt_change`) y qué (`ds_change_type`) cambió
- **Implementación**: Probablemente mediante triggers de PostgreSQL que se ejecutan automáticamente

**Uso:**
- Para auditoría y cumplimiento
- Para recuperar versiones anteriores
- Para análisis de cambios en el tiempo
- Para debugging y troubleshooting

---

## 🏗️ Infraestructura y Stack Tecnológico

### **Frontend: Next.js 14 con App Router**
- **Framework**: Next.js 14
- **Arquitectura**: App Router (nuevo sistema de enrutamiento basado en archivos)
- **Lenguaje**: TypeScript (modo estricto)
- **Estilos**: Tailwind CSS
- **Diseño**: **Móvil-First** (ver sección de Diseño Responsive más abajo)
- **Estructura de Carpetas**:
  ```
  app/              # Rutas y páginas (App Router)
  components/        # Componentes React reutilizables
  lib/              # Utilidades y configuraciones
  types/            # Definiciones TypeScript
  ```

### **🎨 Diseño Responsive y Móvil-First**

**Principio Fundamental**: Esta aplicación está diseñada con un enfoque **móvil-first**. El diseño y la experiencia de usuario están optimizados principalmente para dispositivos móviles, ya que **la introducción de transacciones se realizará principalmente desde el móvil**.

#### **Requisitos de Diseño**:
1. **Prioridad Móvil**: Todos los componentes deben verse y funcionar perfectamente en pantallas pequeñas (320px+)
2. **Experiencia Equivalente**: La experiencia en móvil debe ser tan buena o mejor que en ordenador
3. **Formularios Optimizados**: 
   - Inputs con tamaño de fuente adecuado para móvil (mínimo 16px para evitar zoom automático)
   - Botones con área táctil suficiente (mínimo 44x44px)
   - Espaciado adecuado entre campos
   - Modales que ocupen el ancho completo en móvil con padding adecuado
4. **Navegación Táctil**: Todos los elementos interactivos deben ser fáciles de usar con el dedo
5. **Responsive Breakpoints**: Usar breakpoints de Tailwind:
   - `sm:` 640px+
   - `md:` 768px+
   - `lg:` 1024px+
   - `xl:` 1280px+

#### **Componentes Críticos para Móvil**:
- **TransactionForm**: Formulario principal de creación de transacciones - debe ser completamente usable en móvil
- **DashboardActions**: Botones de acción deben apilarse verticalmente en móvil
- **Modales** (CategoryModal, SubcategoryModal, TagModal): Deben ocupar casi toda la pantalla en móvil
- **Inputs**: Tamaño de fuente mínimo 16px, padding adecuado, fácil de tocar
- **Selects**: Deben ser fáciles de usar en móvil (el navegador mostrará el selector nativo)

#### **Convenciones de Código para Responsive**:
- Empezar con estilos móviles (sin prefijo)
- Añadir estilos para pantallas más grandes con prefijos `sm:`, `md:`, `lg:`
- Usar `flex-col` en móvil y `flex-row` en pantallas grandes cuando sea apropiado
- Padding y márgenes más pequeños en móvil, más grandes en desktop
- Texto más pequeño en móvil, más grande en desktop cuando sea apropiado

### **Backend: Supabase (PostgreSQL)**
- **Base de Datos**: PostgreSQL (hosteada en Supabase)
- **Cliente**: `@supabase/supabase-js` v2.89.0
- **Configuración del Cliente**: 
  - Archivo: `lib/supabase.ts`
  - Tipado: Usa `Database` de `types/supabase.ts`
  - Inicialización: `createClient<Database>(url, key)`
  - Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### **Tipos TypeScript Generados**
- **Archivo**: `types/supabase.ts`
- **Origen**: Generado automáticamente desde el esquema de Supabase
- **Uso**: Importado en `lib/supabase.ts` como `Database`
- **Beneficios**: 
  - Autocompletado completo en el IDE
  - Validación de tipos en tiempo de compilación
  - Detección de errores antes de ejecución
  - Documentación implícita del esquema

### **Variables de Entorno**
- **Archivo**: `.env.local` (en la raíz del proyecto, no versionado)
- **Variables requeridas**:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
  ```
- **Importante**: 
  - El servidor de desarrollo debe reiniciarse después de modificar `.env.local`
  - Las variables `NEXT_PUBLIC_*` están disponibles tanto en servidor como en cliente

---

## ✅ Estado Actual del Proyecto

### **Conexión con Supabase**
- ✅ **Configurada y funcionando**
- ✅ Cliente de Supabase inicializado en `lib/supabase.ts`
- ✅ Tipos TypeScript generados e importados correctamente
- ✅ Variables de entorno configuradas en `.env.local`

### **Página de Prueba**
- ✅ Ruta: `/test-connection`
- ✅ Funcionalidad: 
  - Muestra conteo de registros en `pml_dim_transaction_type` (debería mostrar 2: Income y Expense)
  - Botón para crear familia de prueba en `pml_dim_family`
- ✅ Estado: Funcionando correctamente

### **Datos Iniciales**
- ✅ **Primera familia creada**: Existe al menos un registro en `pml_dim_family` con `ds_family = 'Familia Merino Diaz'`
- ✅ **Tipos de transacción**: Tabla `pml_dim_transaction_type` contiene 2 registros (Income y Expense)

### **Módulo de Analítica**
- ✅ **Ruta**: `/analytics`
- ✅ **Funcionalidad completa**: Visualización de ingresos, gastos, beneficios
- ✅ **Filtros dinámicos**: Por usuario, categoría, subcategoría, tag
- ✅ **Resúmenes**: Totales, por mes, por categoría, por subcategoría
- ✅ **Búsqueda**: Búsqueda de texto libre en transacciones
- ✅ **Optimizaciones**: Reducción de ~98% de queries (de ~420 a ~8)
- ✅ **Estado**: Funcionando y optimizado

### **Estructura del Proyecto**
```
proyecto-gestion-gastos/
├── app/
│   ├── layout.tsx              # Layout raíz
│   ├── page.tsx                 # Página principal (/)
│   ├── globals.css              # Estilos globales
│   ├── login/
│   │   └── page.tsx             # Página de login
│   ├── dashboard/
│   │   └── page.tsx             # Dashboard principal
│   ├── account/
│   │   └── page.tsx             # Página de cuenta del usuario
│   ├── analytics/
│   │   └── page.tsx             # Página de analítica (Server Component)
│   └── auth/
│       └── callback/
│           └── page.tsx         # Callback de autenticación OAuth
├── components/
│   ├── DashboardActions.tsx     # Acciones del dashboard
│   ├── TransactionForm.tsx      # Formulario de transacciones
│   ├── AccountPageClient.tsx    # Cliente de página de cuenta
│   ├── AnalyticsPageClient.tsx  # Cliente de página de analítica
│   ├── CategoryManager.tsx      # Gestión de categorías/subcategorías
│   ├── AddFamilyMemberModal.tsx # Modal para añadir miembros
│   └── ...                      # Otros componentes
├── lib/
│   ├── supabase.ts             # Cliente de Supabase (navegador)
│   ├── supabase-server.ts      # Cliente de Supabase (servidor)
│   ├── supabase-route-handler.ts # Cliente para Route Handlers
│   ├── transactions.ts         # Funciones de transacciones y analítica
│   ├── categories.ts           # Funciones de categorías
│   ├── family.ts               # Funciones de familia y usuarios
│   ├── tags.ts                 # Funciones de tags
│   └── date-utils.ts          # Utilidades de fechas
├── types/
│   ├── supabase.ts             # Tipos generados
│   └── transactions.ts         # Tipos de transacciones
├── scripts/
│   └── check-env.js             # Script de verificación de .env.local
└── .env.local                   # Variables de entorno (no versionado)
```

---

## 📈 Módulo de Analítica

### **Descripción General**

El módulo de analítica proporciona análisis detallado de ingresos, gastos y beneficios con capacidades de filtrado dinámico, visualización de métricas y búsqueda avanzada de transacciones.

**Ruta**: `/analytics`  
**Acceso**: Requiere autenticación, redirige a `/login` si no hay usuario

### **Arquitectura del Módulo**

#### **Estructura de Archivos**
```
app/analytics/
  └── page.tsx                    # Server Component - Autenticación y carga inicial

components/
  └── AnalyticsPageClient.tsx     # Client Component - UI y lógica de estado

lib/transactions.ts               # Funciones de analítica (líneas 223-686)
```

#### **Patrón de Diseño**
- **Server Component + Client Component**: La página servidor maneja autenticación y carga inicial de datos estáticos (miembros, categorías, tags). El componente cliente maneja toda la interactividad, estado y queries dinámicas.
- **Separación de Responsabilidades**: 
  - Queries y lógica de datos: `lib/transactions.ts`
  - UI y estado: `components/AnalyticsPageClient.tsx`
  - Routing y autenticación: `app/analytics/page.tsx`

### **Tipos e Interfaces**

#### **`TransactionWithRelations`**
Extiende `Transaction` con todas las relaciones cargadas:
```typescript
interface TransactionWithRelations extends Transaction {
  category?: { id_category: string; ds_category: string } | null
  subcategory?: { id_subcategory: string; ds_subcategory: string } | null
  tag?: { id_tag: string; ds_tag: string } | null
  users?: Array<{ id_user: string; ds_user: string | null; ft_amount_user: number }>
  transactionType?: 'Income' | 'Expense' | null  // Clave para optimización
}
```

#### **`AnalyticsFilters`**
Filtros aplicables a todas las queries:
```typescript
interface AnalyticsFilters {
  idFamily: string              // Requerido - ID de la familia
  idUser?: string | null         // null = todos los usuarios, string = usuario específico
  idCategory?: string | null    // Filtrar por categoría
  idSubcategory?: string | null // Filtrar por subcategoría
  idTag?: string | null         // Filtrar por tag
  startMonth?: string | null    // Formato YYYY-MM (inclusive)
  endMonth?: string | null      // Formato YYYY-MM (inclusive)
}
```

#### **Interfaces de Resumen**
- **`MonthlySummary`**: Resumen por mes declarado con ingresos, gastos y beneficios
- **`CategorySummary`**: Relevancia de categorías con total, porcentaje y conteo de transacciones
- **`SubcategorySummary`**: Relevancia de subcategorías (incluye información de categoría padre)

### **Funciones Principales**

#### **1. `getTransactionsForAnalytics()`**
Función central que carga transacciones con todas sus relaciones de forma optimizada.

**Flujo de Ejecución**:
1. Query base a `gnp_fct_transactions` con filtros aplicados
2. Extrae IDs únicos de todas las relaciones necesarias
3. Ejecuta 5 queries en paralelo usando `Promise.all()`:
   - Categorías (`pml_dim_category`)
   - Subcategorías (`pml_dim_subcategory`)
   - Tags de transacciones (`pml_rel_transaction_tag`)
   - Usuarios de transacciones (`pml_rel_transaction_user`)
   - **Tipos de transacción** (`pml_dim_transaction_type`) ← Clave para evitar N+1
4. Queries adicionales secuenciales (solo si hay datos):
   - Tags (`pml_dim_tag`) - depende de `pml_rel_transaction_tag`
   - Usuarios (`pml_dim_user`) - depende de `pml_rel_transaction_user`
5. Combina datos usando `Map` para acceso O(1)
6. Aplica filtros de usuario/tag en memoria
7. Retorna array de `TransactionWithRelations` con `transactionType` ya incluido

**Optimizaciones Clave**:
- Queries en paralelo para reducir tiempo de carga
- Una sola query para tipos (evita problema N+1)
- Maps para lookups eficientes O(1)
- Filtrado en memoria después de cargar

#### **2. Funciones de Cálculo (Sin Queries)**
Funciones puras que procesan datos ya cargados (sin acceso a base de datos):

**`calculateTotalSummary(transactions)`**:
- Agrupa por `transactionType` ('Income'/'Expense')
- Suma importes por tipo
- Calcula beneficios (income - expense)
- Retorna: `{ income: number, expense: number, benefit: number }`

**`calculateMonthlySummary(transactions)`**:
- Agrupa por `ds_month_declared`
- Separa ingresos/gastos por tipo
- Calcula beneficios por mes
- Ordena cronológicamente
- Retorna: `MonthlySummary[]`

**`calculateCategorySummary(transactions)`**:
- Filtra solo `transactionType === 'Expense'`
- Agrupa por categoría
- Calcula totales y porcentajes
- Ordena por total descendente
- Retorna: `CategorySummary[]`

**`calculateSubcategorySummary(transactions)`**:
- Similar a categorías pero por subcategoría
- Incluye información de categoría padre
- Retorna: `SubcategorySummary[]`

#### **3. Funciones Legacy (Deprecated)**
Funciones async mantenidas para compatibilidad pero no utilizadas:
- `getTotalSummary()` → usa `calculateTotalSummary()` internamente
- `getMonthlySummary()` → usa `calculateMonthlySummary()` internamente
- `getCategorySummary()` → usa `calculateCategorySummary()` internamente
- `getSubcategorySummary()` → usa `calculateSubcategorySummary()` internamente

#### **4. `searchTransactions()`**
Búsqueda de texto libre en transacciones:
- Usa `getTransactionsForAnalytics()` para obtener datos
- Filtra en memoria por:
  - Comentarios (`ds_comments`)
  - Nombre de categoría
  - Nombre de subcategoría
  - Nombre de tag
  - Importe (como string)
- Aplica límite opcional
- Retorna: `TransactionWithRelations[]`

### **Componente Cliente: `AnalyticsPageClient`**

#### **Estado del Componente**
```typescript
- filters: AnalyticsFilters          // Filtros generales (usuario, tag, meses)
- loading: boolean                   // Estado de carga
- totalSummary: {...}                // Resumen total
- monthlySummary: MonthlySummary[]   // Resumen por mes
- categorySummary: CategorySummary[] // Resumen por categoría
- subcategorySummary: SubcategorySummary[] // Resumen por subcategoría
- kpiSummary: KPISummary            // KPIs calculados
- activeTab: 'overview' | 'categories' | 'comparator' | 'month-analysis' // Tab activa
- filtersVisible: boolean            // Visibilidad del popup de filtros

// Comparador
- comparatorSubTab: 'between-months' | 'over-time'
- monthA, monthB: string             // Meses seleccionados para comparación
- monthComparison: MonthComparison | null
- comparatorCategoryFilter: string   // Filtro de categoría en comparador
- comparatorSubcategoryFilter: string // Filtro de subcategoría en comparador
- availableSubcategoriesForComparator: Array<...>

// En el tiempo
- transactionTypeForTime: 'Income' | 'Expense' | ''
- selectedCategoryForTime: string
- selectedSubcategoryForTime: string
- timeStartMonth: string             // Mes desde para análisis temporal
- timeEndMonth: string               // Mes hasta para análisis temporal
- timeEvolutionData: Array<...>      // Datos para gráfica de línea
- timeEvolutionTransactions: TransactionWithRelations[]
- timeTableSortBy: 'date' | 'month' | 'amount'
- timeTableSortOrder: 'asc' | 'desc'

// Categorías
- categoryFilter: string             // Filtro de categoría en tab Categorías
- subcategoryFilter: string          // Filtro de subcategoría en tab Categorías
- availableSubcategoriesForFilter: Array<...>

// Análisis Mensual
- selectedMonth: string
- monthAnalysis: MonthAnalysis | null
- monthAnalysisTab: 'expenses' | 'incomes' // Tab para alternar gastos/ingresos
- expenseTableFilters: {...}         // Filtros para tabla de gastos
- incomeTableFilters: {...}          // Filtros para tabla de ingresos
```

#### **Flujo de Carga de Datos**
1. `useEffect` se dispara cuando cambian los filtros
2. `loadAnalytics()` ejecuta:
   - Llama a `getTransactionsForAnalytics()` **UNA SOLA VEZ**
   - Calcula todos los resúmenes en el cliente usando funciones `calculate*`
   - Actualiza el estado con todos los datos
3. Re-render con datos actualizados

#### **Estructura de UI**
- **Filtros Generales** (Popup con icono de lupa):
  - Usuario afectado (aplica a TODO)
  - Tag (aplica a TODO)
  - Mes Desde (meses declarados, aplica a TODO)
  - Mes Hasta (meses declarados, aplica a TODO)
- **Tabs Principales**: 
  - **Resumen (Overview)**: Métricas principales, KPIs, gráficos de evolución
  - **Categorías**: Distribución por categorías y subcategorías con pie charts
  - **Comparador**: Comparación entre meses y análisis temporal
  - **Análisis Mensual**: Análisis detallado de un mes específico
- **Tab Resumen**: 
  - KPIs genéricos: Ingresos totales, Beneficios totales, Beneficio medio mensual (mediana con %)
  - Gráfico combinado: Ingresos/Gastos/Beneficio (barras) + Ahorro Acumulado (línea)
  - Evolución financiera mensual
- **Tab Categorías**: 
  - Filtros específicos: Categoría y/o Subcategoría
  - Pie charts de categorías y subcategorías (sin etiquetas de porcentaje visibles)
  - Visualización de valores absolutos y porcentajes al hacer hover/click
  - Barras de progreso con porcentajes
- **Tab Comparador**: 
  - **Sub-tab "Entre meses"**:
    - Selectores de Mes A y Mes B
    - Filtros opcionales: Categoría y/o Subcategoría
    - Comparación Total: 3 tarjetas (Ingresos, Gastos, Beneficio) con diferencias en verde/rojo
    - Comparación por Categoría: Tabla de diferencias con headers mostrando solo valores de mes (MM-YYYY)
    - Comparación Top Gastos: Top 5 gastos (formato: Comentario - Categoría - Subcategoría -------- cantidad, fecha DD/MM/YYYY debajo), Top 5 categorías, Top 5 subcategorías
  - **Sub-tab "En el tiempo"**:
    - Selector inicial de tipo: Ingresos o Gastos
    - Filtros: Categoría (opcional), Subcategoría (opcional), Mes Desde, Mes Hasta
    - Gráfica de línea: Evolución mensual (verde para ingresos, rojo para gastos)
    - Tabla de detalle: Transacciones ordenables por fecha, mes declarado o amount (default: fecha descendente)
- **Tab Análisis Mensual**: 
  - Selector de mes
  - KPIs principales: Beneficio mensual y Diferencia con mediana
  - Tabs para alternar entre Gastos e Ingresos
  - **Subsección Gastos**:
    - Total de gastos
    - Pie charts de categorías y subcategorías (tamaño reducido, sin etiquetas)
    - Top 5 gastos (formato mejorado, cantidad a la derecha)
    - Top 5 categorías y Top 5 subcategorías
    - Tabla de detalle con filtros: Fecha desde/hasta, Categoría, Subcategoría
  - **Subsección Ingresos**:
    - Total de ingresos
    - Pie chart de categorías (centrado, único)
    - Top 5 ingresos y Top 5 categorías (sin subcategorías)
    - Tabla de detalle con filtros: Fecha desde/hasta, Categoría (sin subcategoría)

### **Optimizaciones Implementadas**

#### **Problema N+1 Resuelto**
**Antes**:
```typescript
for (const transaction of transactions) {
  const { data } = await supabase
    .from('pml_dim_transaction_type')
    .select('ds_type')
    .eq('id_type', transaction.id_type)
    .single()  // ← 1 query por transacción
}
```

**Ahora**:
```typescript
// 1 query para todos los tipos
const { data: types } = await supabase
  .from('pml_dim_transaction_type')
  .select('id_type, ds_type')
  .in('id_type', typeIds)  // ← 1 query para todas las transacciones
```

#### **Carga Única de Datos**
- **Antes**: `getTransactionsForAnalytics()` se llamaba 4 veces (una por cada función de resumen)
- **Ahora**: Se llama 1 vez y los cálculos se hacen en memoria

#### **Paralelización**
- **Antes**: Queries secuenciales (una tras otra)
- **Ahora**: 5 queries en paralelo usando `Promise.all()`

#### **Resultado de Optimización**
- **Antes**: ~420 queries (con 100 transacciones)
- **Ahora**: ~6-8 queries (todas en paralelo)
- **Reducción**: ~98% de queries
- **Tiempo de carga**: De varios segundos a <1 segundo

### **Flujo de Datos Completo**

```
Usuario accede a /analytics
    ↓
app/analytics/page.tsx (Server Component)
    ├─ Verifica autenticación (redirect si no hay usuario)
    ├─ Obtiene familia del usuario
    └─ Carga datos iniciales en paralelo:
       ├─ getFamilyMembers()
       ├─ getAllCategoriesByFamily()
       └─ getTagsByFamily()
    ↓
Renderiza AnalyticsPageClient con props
    ↓
AnalyticsPageClient (Client Component)
    ├─ Inicializa estado y filtros
    ├─ useEffect → loadAnalytics()
    │   └─ getTransactionsForAnalytics()
    │       ├─ Query transacciones (1 query)
    │       ├─ 5 queries en paralelo (categorías, subcategorías, tags, usuarios, tipos)
    │       └─ 2 queries condicionales (tags, usuarios) - secuenciales
    │   └─ Calcula resúmenes en memoria (sin queries):
    │       ├─ calculateTotalSummary()
    │       ├─ calculateMonthlySummary()
    │       ├─ calculateCategorySummary()
    │       └─ calculateSubcategorySummary()
    └─ Renderiza UI con datos
```

### **Dependencias y Relaciones**

#### **Dependencias Externas**
- `@supabase/supabase-js`: Cliente de Supabase
- `@supabase/ssr`: Cliente SSR de Supabase
- `next/navigation`: Routing y redirects
- `react`: Hooks y estado

#### **Dependencias Internas**
- `lib/supabase`: Cliente del navegador
- `lib/supabase-server`: Cliente del servidor
- `lib/family`: Funciones de familia y usuarios
- `lib/categories`: Funciones de categorías
- `lib/tags`: Funciones de tags
- `types/supabase`: Tipos TypeScript generados

#### **Tablas de Base de Datos Utilizadas**
- `gnp_fct_transactions`: Transacciones principales
- `pml_dim_category`: Categorías
- `pml_dim_subcategory`: Subcategorías
- `pml_dim_transaction_type`: Tipos (Income/Expense)
- `pml_dim_tag`: Tags
- `pml_dim_user`: Usuarios
- `pml_rel_transaction_tag`: Relación transacción-tag
- `pml_rel_transaction_user`: Relación transacción-usuario (con `ft_amount_user`)

### **Consideraciones Técnicas**

#### **Formato de Fechas**
- `ds_month_declared`: Formato YYYY-MM en base de datos
- `monthDisplay`: Formato MM-YYYY para mostrar al usuario
- Conversión: `convertDBFormatToMonthYear()` (si existe)

#### **Precisión Numérica**
- Uso de `Number.EPSILON` para evitar errores de punto flotante
- Redondeo a 2 decimales: `Math.round((value + Number.EPSILON) * 100) / 100`

#### **Filtrado por Usuario**
- Si `filters.idUser` está definido, ajusta `ft_amount` al `ft_amount_user` del usuario específico
- Permite ver analítica individual o familiar

#### **Mobile-First**
- Diseño completamente responsive con Tailwind CSS
- Tamaños de toque mínimos: 44px
- Clases `touch-manipulation` para mejor UX móvil
- **Gráficos Interactivos**: Pie charts y barras son clickeables en mobile para mostrar % y valor total
- **Pie Charts Optimizados**: Sin etiquetas de porcentaje visibles (solo en tooltip/click)
- **Tamaños Reducidos**: Pie charts en análisis mensual con altura de 200px (antes 300px)

### **Puntos de Extensión**

#### **Filtros Adicionales**
- Añadir campos a `AnalyticsFilters`
- Actualizar `getTransactionsForAnalytics()` con nuevos filtros

#### **Nuevos Resúmenes**
- Crear función `calculate*Summary()` similar
- Añadir estado y UI en `AnalyticsPageClient`

#### **Caché**
- Implementar caché de transacciones en el cliente
- Invalidar cuando se crean/actualizan transacciones

#### **Paginación**
- Para grandes volúmenes, añadir paginación en `searchTransactions()`

### **Métricas de Rendimiento**

#### **Queries por Carga**
- **Mínimo**: 6 queries (sin tags ni usuarios)
- **Máximo**: 8 queries (con todos los datos)
- **Paralelización**: Todas en paralelo excepto tags y usuarios (dependen de relaciones)

#### **Complejidad Temporal**
- `getTransactionsForAnalytics`: O(n) donde n = número de transacciones
- Funciones `calculate*`: O(n) para agrupación
- Búsqueda: O(n) para filtrado en memoria

#### **Complejidad Espacial**
- Maps para lookups: O(m) donde m = número de entidades únicas
- Arrays de transacciones: O(n)

---

## 📝 Convenciones de Código

### **Nomenclatura de Archivos**
- **Archivos**: kebab-case (ej: `test-connection`, `check-env.js`)
- **Componentes**: PascalCase (ej: `TestConnection`, `RootLayout`)
- **Utilidades**: camelCase (ej: `createSupabaseClient`)

### **Imports**
- Usar path aliases `@/` para imports absolutos desde la raíz
- Ejemplo: `import { supabase } from '@/lib/supabase'`

### **Componentes React**
- **Server Components por defecto**: No usar `'use client'` a menos que sea necesario
- **Client Components**: Solo cuando se necesita interactividad (hooks, eventos, estado)
- **Tipado**: Usar TypeScript estricto, definir tipos en `types/` cuando sea necesario

### **Operaciones de Base de Datos**
- Siempre usar los tipos generados de `types/supabase.ts`
- Usar los nombres de campos correctos según la nomenclatura (`ds_*`, `dt_*`, `ft_*`, etc.)
- No establecer `dt_updated` manualmente (se actualiza automáticamente)
- Considerar el sistema de logs para operaciones críticas

---

## 🚀 Próximos Pasos Sugeridos

1. ✅ **Sistema de Autenticación**: Implementado con Google OAuth
2. ✅ **CRUD de Transacciones**: Implementado (crear gastos/ingresos)
3. ✅ **Dashboard**: Vista principal implementada
4. ✅ **Filtros y Búsqueda**: Implementado en módulo de analítica
5. ✅ **Componentes UI**: Componentes reutilizables creados
6. ✅ **Validación de Datos**: Implementada en formularios
7. ⏳ **Manejo de Errores**: Sistema básico implementado, puede mejorarse
8. ✅ **Visualizaciones Gráficas**: Implementado con Recharts (pie charts, barras, líneas)
9. ⏳ **Exportación de Datos**: Exportar analítica a CSV/PDF
10. ⏳ **Notificaciones**: Sistema de notificaciones para cambios importantes

---

## 🆕 Cambios Recientes (Última Sesión)

### **Mejoras en el Módulo de Analítica**

#### **1. Sección "En el tiempo" en Comparador**
- **Selector de Tipo**: Primera pregunta para elegir entre Ingresos o Gastos
- **Filtrado Inteligente**: Las categorías se filtran automáticamente según el tipo seleccionado
- **Gráfica de Línea**: 
  - Color verde (#10b981) para ingresos
  - Color rojo (#ef4444) para gastos
  - Muestra evolución mensual del valor total
- **Filtros Temporales**: Mes Desde y Mes Hasta para limitar el rango de análisis
- **Tabla de Detalle**: 
  - Columnas: Fecha, Mes Declarado, Comentario, Categoría, Subcategoría, Personas, Amount
  - Ordenable por fecha, mes declarado o amount
  - Orden por defecto: fecha descendente

#### **2. Reestructuración de Análisis Mensual**
- **KPIs Principales**:
  - Beneficio mensual del mes seleccionado
  - Diferencia con mediana (beneficio mensual - mediana)
- **Tabs de Navegación**: Alternar entre Gastos e Ingresos sin scroll
- **Subsección Gastos**:
  - Total de gastos destacado
  - Pie charts de categorías y subcategorías (tamaño reducido)
  - Top 5 gastos con formato mejorado (cantidad alineada a la derecha)
  - Top 5 categorías y subcategorías
  - Tabla de detalle con filtros: fecha desde/hasta, categoría, subcategoría
- **Subsección Ingresos**:
  - Total de ingresos destacado
  - Pie chart único de categorías (centrado)
  - Top 5 ingresos y categorías (sin subcategorías)
  - Tabla de detalle sin columna de subcategoría ni filtro de subcategoría

#### **3. Mejoras en Visualización de Gráficos**
- **Eliminación de Etiquetas**: Los pie charts ya no muestran porcentajes visibles en cada sección
- **Interactividad Mobile**: 
  - Pie charts y barras son clickeables
  - Al hacer click muestra alert con nombre, valor absoluto y porcentaje
  - Especialmente útil en dispositivos móviles donde no hay hover
- **Tamaños Optimizados**: Pie charts reducidos de 300px a 200px de altura

#### **4. Reorganización de Filtros**
- **Filtros Generales** (Popup con lupa, aplican a TODO):
  - Usuario afectado
  - Tag
  - Mes Desde (meses declarados)
  - Mes Hasta (meses declarados)
- **Filtros Específicos por Sección**:
  - **Categorías**: Filtros de categoría y/o subcategoría
  - **Comparador (Entre meses)**: Filtros opcionales de categoría y/o subcategoría
  - **En el tiempo**: Filtros de Mes Desde y Mes Hasta además de categoría/subcategoría
- **Eliminación**: Filtro de búsqueda de texto libre en tablas de detalle

#### **5. Eliminación de Sección Estimaciones**
- La pestaña "Estimaciones" ha sido eliminada completamente
- Funcionalidad de proyección a diciembre removida

### **Funciones Nuevas/Modificadas**

#### **`calculateTimeEvolution()`**
- Filtra transacciones por tipo (Income/Expense), categoría, subcategoría y rango de meses
- Agrupa por mes declarado para la gráfica de línea
- Prepara lista de transacciones para tabla ordenable

#### **`getExpenseData()` / `getIncomeData()`**
- Calculan datos separados por tipo de transacción para análisis mensual
- Incluyen: total, transacciones, categorías, subcategorías, top 5 de cada tipo

#### **`getFilteredExpenses()` / `getFilteredIncomes()`**
- Aplican filtros de fecha, categoría y subcategoría a las tablas de detalle
- Ordenan por fecha descendente por defecto

### **Mejoras en UX**
- **Navegación Mejorada**: Tabs para alternar entre secciones sin scroll excesivo
- **Información Contextual**: Tooltips y alerts muestran % y valor absoluto
- **Formato Consistente**: Top 5 gastos/ingresos con formato uniforme
- **Filtros Intuitivos**: Filtros generales separados de filtros específicos por sección

---

**Última actualización**: Diciembre 2024
**Versión del proyecto**: v0.4.0 (Analítica Avanzada con Comparador Temporal y Análisis Mensual Detallado)


