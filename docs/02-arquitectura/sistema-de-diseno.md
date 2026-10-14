# Sistema de diseño

Código en `app/src/shared/theme/` (tokens) y `app/src/shared/ui/` (componentes). Vitrina en la app: **Perfil › Sistema de diseño** (solo en desarrollo, ruta `/design-system`).

## Tokens
- **Color semántico** (`colors.ts`): los componentes piden un rol, nunca un hex. Superficies `background`, `card`, `surface`; marca `primary`/`accent`; estados `danger`/`warning`. Cada `*Container` tiene su `on*Container`. Modo claro y oscuro con las mismas claves.
- **Contraste**: `__tests__/contrast.test.ts` exige AA (≥ 4.5:1) en 50 combinaciones de texto y fondo en ambos modos. Un color nuevo no entra sin pasarla.
- **Tipografía** (`tokens.ts`): títulos en serif **DM Serif Display** (como la paleta de marca): `display 34 · title 28 · heading 21`; texto en la del sistema: `subtitle 17 · body 16 · label 14 · caption 13`. Crece con el tamaño de letra del teléfono.
- **Bloques de marca**: `brand` (Space Cadet) con `onBrand` (Tan) y `onBrandMuted` (Slate Gray aclarado), en la barra de pestañas, los encabezados y `Card variant="brand"`.
- **Radios**: `sm 8 · md 12 · lg 16 · xl 24 · pill`. **Espaciado**: múltiplos de 4 (`xxs 2` … `xxl 48`). **Sombras**: `elevation(1 | 2, color)`.
- **Tema**: Perfil › Apariencia (como el teléfono / claro / oscuro), aplicado con `Appearance.setColorScheme`.

## Componentes
| Componente | Uso |
|---|---|
| `AppText` | Texto con `variant` de la escala y `tone` (secondary, primary, danger, warning) |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; `size="sm"`; `icon` opcional; 48 pt |
| `TextLink` | Acción de texto con 44 pt táctiles |
| `Card` | `elevated` (por defecto), `primary` (destacada), `filled`, `outlined` |
| `Banner` | Aviso con ícono por tono (info, success, warning, danger) |
| `Pill` | Metadato o estado corto ("35 min", "Vence pronto") |
| `ProgressBar` | Progreso accesible ("tienes el 75 %") |
| `SegmentedControl` | Una opción entre pocas (momento del día) |
| `IconBadge` | Ícono decorativo con fondo de tono |
| `SectionHeader` | Título de sección con acción opcional |
| `Chip` / `Stepper` / `TextField` / `Checkbox` | Formularios y selección |
| `EmptyState` / `ErrorState` / `LoadingState` | Estados obligatorios de cada pantalla, con ícono |
| `BrandHeader` | Encabezado de marca (Space Cadet + serif Tan) que abre cada pestaña, la receta y el onboarding; `action` a la derecha y `back` a la izquierda |
| `IconButton` | Botón de solo ícono de 44 pt con etiqueta para el lector (perfil, quitar, volver) |
| `FormSection` | Tarjeta de una sola decisión: ícono, pregunta, ayuda y controles |
| `StepProgress` | Avance por pasos accesible (onboarding) |
| `ListGroup` / `ListRow` | Ajustes agrupados: fila completa tocable con ícono, resumen y flecha; `danger` para salir o eliminar |
| `TextField` `icon` | Ícono a la izquierda del campo (correo, candado, búsqueda) |
| `Checkbox` `strikeWhenChecked` | Tacha lo marcado (lista de mercado) |

## Reglas
1. Nada de colores, tamaños o radios sueltos en las pantallas: siempre tokens.
2. El significado nunca va solo en el color: también en texto o ícono.
3. Todo lo tocable mide ≥ 44 pt y tiene `accessibilityRole` y etiqueta.
4. Un enlace o botón con ícono anuncia solo su texto (`accessibilityLabel` explícito), nunca el glifo del ícono.
5. Cada pantalla abre con `BrandHeader` (o `AuthScaffold` en el acceso): una sola pieza de marca por pantalla.
