# Sistema de diseño

Código en `app/src/shared/theme/` (tokens) y `app/src/shared/ui/` (componentes). Vitrina en la app: **Perfil › Sistema de diseño** (solo en desarrollo, ruta `/design-system`).

## Tokens
- **Paleta "Cocina viva"**: cuatro sabores sobre neutros cálidos (crema de día, café tostado de noche). Cada sección tiene el suyo: **tomate** `#BC3F0B` (Hoy, marca), **albahaca** `#2F7A3E` (Mi cocina, éxito), **mango** `#F2B21B` con texto oscuro (Mi semana, avisos) y **mora** `#8A3E7A` (Asistente). `flavorColors(c, sabor)` da `fill`, `onFill`, `container` y `onContainer`.
- **Color semántico** (`colors.ts`): los componentes piden un rol, nunca un hex. Superficies `background`, `card`, `surface`; marca `primary`/`accent`; estados `success`/`danger`/`warning`. Cada `*Container` tiene su `on*Container`. Modo claro y oscuro con las mismas claves.
- **Contraste**: `__tests__/contrast.test.ts` exige AA (≥ 4.5:1) en 78 combinaciones de texto y fondo en ambos modos (incluidos los cuatro sabores). Un color nuevo no entra sin pasarla.
- **Tipografía** (`tokens.ts`): la del sistema (Roboto en Android, la misma familia que usan WhatsApp y Facebook), sin fuentes descargadas. `display 32 · title 28 · heading 20 · subtitle 18 · body 17 · label 15 · caption 14`. El cuerpo en 17 pensando en personas mayores. Crece con el tamaño de letra del teléfono.
- **Íconos y emojis**: íconos de línea (Ionicons) para la interfaz; emojis solo para la comida.
- **Radios**: `sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · pill`. **Espaciado**: múltiplos de 4 (`xxs 2` … `xxl 48`). **Sombras** cálidas: `elevation(1 | 2, c.shadow)`. Botones de 52 pt (`ButtonHeight`).
- **Tema**: Perfil › Apariencia (como el teléfono / claro / oscuro), aplicado con `Appearance.setColorScheme`.

## Componentes
| Componente | Uso |
|---|---|
| `AppText` | Texto con `variant` de la escala y `tone` (secondary, primary, danger, warning) |
| `Button` | `primary` (lleno), `secondary` (tonal), `outline`, `ghost`, `danger`; `flavor` para el sabor de la sección; `size="sm"`; `icon` opcional; 52 pt |
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
| `BrandHeader` | Encabezado claro que abre cada pestaña, la receta y el onboarding: antetítulo, título, barrita del sabor (`flavor`) y subtítulo; `action` a la derecha y `back` a la izquierda |
| `FloatingTabBar` | Barra de pestañas flotante (Hoy, Mi cocina, Mi semana, Asistente): la activa se llena con su sabor, el nombre siempre visible y se esconde con el teclado |
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
5. Cada pantalla abre con `BrandHeader` (o `AuthScaffold` en el acceso) con el sabor de su sección: un solo sabor protagonista por pantalla.
6. El texto crece con la letra del sistema: nada de `allowFontScaling={false}` ni `numberOfLines={1}`; alturas con `minHeight`, no `height`. Solo un adorno puramente decorativo (oculto al lector) puede limitar su escala con `maxFontSizeMultiplier`.

## Verificación de accesibilidad (US-140)
**Automática** (corre con `npm test` y en CI):
- `shared/theme/__tests__/contrast.test.ts`: todos los pares de texto y fondo cumplen AA (≥ 4,5:1) en claro y oscuro.
- `src/test/a11y-static.test.ts`: todo `Pressable`, `Image`, `TextInput` y `Switch` tiene `accessibilityLabel` (o está oculto por ser decorativo); nadie desactiva el texto escalable; ningún texto se corta a una línea.

**Manual en un teléfono Android** (antes de cada entrega):
1. Ajustes › Accesibilidad › Tamaño de fuente al máximo y Tamaño de visualización grande: recorrer Preferencias (Tiempo y gustos), Mi semana, una receta y la lista de mercado. Nada cortado ni encimado.
2. TalkBack activado en esas mismas pantallas: cada control se anuncia con su nombre y estado (marcado, seleccionado, deshabilitado), sin leer símbolos de íconos.
3. Modo oscuro: repetir 1.

