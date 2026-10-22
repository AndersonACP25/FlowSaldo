# DESIGN.md — FlowSaldo Design System

## 1. Visión y Personalidad de Marca
**FlowSaldo** es una plataforma FinTech moderna enfocada en la automatización de finanzas personales a través de la ingesta y clasificación inteligente de correos bancarios.
- **Tono**: Confiable, analítico, seguro, ágil y de alta tecnología.
- **Modo principal**: Dark Mode nativo (estilo Obsidian / Dark Slate con acentos esmeralda y cian de alto contraste).

---

## 2. Paleta de Colores y Tokens

### Superficies y Fondos (Dark Palette)
- **`surface-canvas`**: `#0a0e16` — Fondo principal de pantalla (canvas profundo).
- **`surface-card` / `surface-container-low`**: `#0f131c` — Tarjetas principales y contenedores base.
- **`surface-card-hover` / `surface-container`**: `#181c24` — Módulos secundarios, inputs y contenedores elevados.
- **`surface-highlight` / `surface-container-high`**: `#222734` — Elementos interactivos en reposo, badges y chips inactivos.
- **`surface-border`**: `#1e2430` / `#2d3748` — Bordes sutiles con opacidad para delimitar tarjetas.

### Marca y Acentos Semánticos
- **Primary / Emerald Accent**:
  - `primary-default`: `#10b981` (Emerald 500) — CTA principal, montos positivos/ingresos, estados confirmados y toggles activos.
  - `primary-glow`: `rgba(16, 185, 129, 0.15)` — Fondos de chips positivos y auras de estado.
  - `primary-dark`: `#059669` — Hover/pressed en botones primarios.
- **Secondary / Cyan Tech**:
  - `secondary-accent`: `#06b6d4` — Indicadores de latencia, IA y sincronización de correo.
  - `secondary-glow`: `rgba(6, 182, 212, 0.15)` — Pills de estados de conectividad.
- **Semantic Status**:
  - **Gastos / Alertas / Negativo**: `#f43f5e` (Rose) / `#ef4444` (Red) — Salidas de dinero, comercios dudosos, badges de atención urgente.
  - **Transferencias / Traspasos**: `#38bdf8` (Sky Blue) — Movimientos neutros o entre cuentas propias.
  - **Información / Reglas**: `#a855f7` (Purple) — Reglas automáticas de IA y categorización predictiva.
  - **Precaución / Triage**: `#f59e0b` (Amber) — Movimientos pendientes de verificación manual.

### Tipografía y Jerarquía de Texto
- **Fuente**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`.
- **Text Tokens**:
  - `text-primary`: `#ffffff` — Títulos, cifras de balance y nombres de comercios principales.
  - `text-secondary`: `#94a3b8` (Slate 400) — Subtítulos, bancos, etiquetas y metadatos.
  - `text-muted`: `#64748b` (Slate 500) — Fechas, marcas de tiempo secundarias e identificadores de transacción.
  - `text-accent`: `#10b981` — Cifras de ingresos y porcentajes de mejora.

---

## 3. Tipografía & Escala
- **Display / Big Numbers**: `text-3xl font-extrabold tracking-tight` (ej. Balances principales: `$42,850.00`).
- **Heading 1**: `text-xl font-bold` (ej. Título de módulos y encabezados de mes).
- **Heading 2**: `text-base font-semibold` (ej. Nombre del comercio o regla).
- **Body & Data**: `text-sm font-normal` (ej. Subtexto de tarjeta: `Tarjeta Nu • 18:42`).
- **Labels & Microcopy**: `text-xs font-medium uppercase tracking-wider` (ej. Estados, badges de bancos y pills de filtros).
- **Tabular Numbers**: Utilizar siempre `tabular-nums` o fuentes con espaciado mono para cifras y montos monetarios.

---

## 4. Radios, Elevación y Bordes
- **Border Radius**:
  - Tarjetas y contenedores: `rounded-2xl` (`16px`).
  - Botones, inputs y chips de filtro: `rounded-xl` (`12px`) o `rounded-full` para pills.
  - Badges de banco/avatar: `rounded-lg` (`8px`) o `rounded-full`.
- **Bordes**:
  - `border border-surface-border` (`1px solid #1e2430`) para delimitar sin sobrecargar el contraste oscuro.
- **Sombras**:
  - Sutiles y difusas: `shadow-lg shadow-black/40` en tarjetas flotantes y la barra de navegación inferior.

---

## 5. Patrones de Componentes

### 1. Indicador de Flujo de Transacciones
- Formato uniforme: `Icono Banco / Comercio + Nombre & Metadata a la izquierda` | `Monto & Tipo a la derecha`.
- Signos y colores:
  - Ingresos: `+$XX.XX` en `text-emerald-400`.
  - Gastos: `-$XX.XX` en `text-white` o `text-slate-100`.
  - Badges inferiores: Chip con icono pequeño (`Correo confirmado`, `CFDI`, etc.).

### 2. Tarjetas de Triage ("Por Revisar")
- Tarjeta contenedora con borde destacado sutil.
- Snippet explicativo de la duda del modelo de IA con fondo oscuro diferenciado (`bg-surface-container`).
- Botones de acción binaria/ternaria al pie: `Confirmar`, `Cambiar`, `Desglosar`.
- Enlace desplegable inferior (`Ver correo original de alerta`).

### 3. Filtros y Segmented Controls
- Contenedor en cápsula (`rounded-xl` o `rounded-full`) con fondo oscuro.
- Estado activo con fondo sólido (`bg-emerald-500` o `bg-slate-700`) y texto contrastante.

### 4. Navegación Global (Shell)
- **Header**: Logo tipográfico FlowSaldo con glifo distintivo cian/esmeralda, indicador de estado de conexión activo y avatar de usuario.
- **Bottom Navigation Bar**: 4 accesos fijos (`Panel`, `Movimientos`, `Por Revisar` con badge de conteo pendiente en rojo/rosa, y `Conexiones`).