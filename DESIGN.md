---
name: Pixie
description: Asistente de escritorio para Windows con cara animada; su página de descarga está habitada por la cara real.
colors:
  screen: "#04060a"
  bezel: "#141922"
  pixel-dot: "#0c131c"
  ice: "#9cd3ff"
  ice-hover: "#c4e5ff"
  ice-ink: "#06121f"
  ice-ink-hover: "#12263c"
  ice-line: "rgba(156, 211, 255, 0.2)"
  ice-tint: "rgba(156, 211, 255, 0.1)"
  text: "#e6edf7"
  muted: "#a3afc2"
  amber: "#f4b968"
  amber-ink: "#231504"
  night: "#121a3d"
  reply-surface: "rgba(13, 17, 24, 0.96)"
  taskbar: "rgba(4, 6, 10, 0.88)"
  paper: "#f7f9fc"
  paper-ink: "#1b2430"
typography:
  display:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(3.25rem, 7.2vw, 6rem)"
    fontWeight: 600
    lineHeight: 1.05
  display-closing:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(3rem, 8vw, 6rem)"
    fontWeight: 600
    lineHeight: 1.05
  headline:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.05
  title-name:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.05
  action:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
rounded:
  pixel-screen: "4px"
  key: "6px"
  button-compact: "9px"
  control: "10px"
  button: "12px"
  bubble: "14px"
  bezel-small: "18px"
  bezel: "clamp(18px, 3vw, 36px)"
spacing:
  gap: "0.5rem"
  control-x: "0.875rem"
  row: "1.125rem"
  button-x: "1.75rem"
  gutter: "clamp(1rem, 4vw, 3.5rem)"
  column: "clamp(2rem, 6vw, 6rem)"
  band: "clamp(4rem, 10vh, 7rem)"
components:
  button-primary:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.ice-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "0 1.75rem"
    height: "3.5rem"
  button-primary-hover:
    backgroundColor: "{colors.ice-hover}"
  button-compact:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.ice-ink}"
    rounded: "{rounded.button-compact}"
    padding: "0 0.875rem"
    height: "2.75rem"
  button-closing:
    backgroundColor: "{colors.ice-ink}"
    textColor: "{colors.ice}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "0 1.75rem"
    height: "3.5rem"
  button-closing-hover:
    backgroundColor: "{colors.ice-ink-hover}"
  chip-request:
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.25rem 0.875rem"
    height: "2.75rem"
  chip-request-active:
    backgroundColor: "{colors.ice-tint}"
    textColor: "{colors.text}"
  reply-bubble:
    backgroundColor: "{colors.reply-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.bubble}"
    padding: "0.5rem 0.875rem"
  device-bezel:
    backgroundColor: "{colors.bezel}"
    rounded: "{rounded.bezel}"
    padding: "clamp(10px, 1.6vw, 22px)"
  device-bezel-small:
    backgroundColor: "{colors.bezel}"
    rounded: "{rounded.bezel-small}"
    padding: "10px"
  top-bar:
    backgroundColor: "{colors.screen}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "0 clamp(1rem, 4vw, 3.5rem)"
    height: "3.75rem"
  desk-window:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 1rem 1rem"
    width: "22rem"
---

# Design System: Pixie

## Overview

**Creative North Star: "La pantallita encendida"**

El sistema sale de un objeto: la pantalla OLED de 64 por 32 píxeles que Pixie heredó de un reloj con ESP32, dentro de su marco. La página no ilustra ese objeto. Lo corre: el canvas usa el mismo código de dibujo y animación que la app, la cara mira al puntero, pestañea y responde a los pedidos de ejemplo.

Todo lo demás se ordena alrededor de la cara. La base es la negrura de la pantalla, con bandas planas separadas por una línea fina celeste. En los dos momentos donde la página cambia de escala, el negro cede a campos de color llenos: el escritorio pasa de ámbar a celeste y a noche durante el scroll, y el cierre es un campo celeste completo. La densidad es baja, con títulos grandes en Pixelify Sans y texto en Atkinson Hyperlegible Next, hecho para leerse sin esfuerzo.

La dirección rechaza el hero de texto más captura de producto: la cara ocupa ese lugar y funciona.

**Key Characteristics:**
- Una cara real en canvas como pieza central, en múltiplos enteros de su grilla de 64 × 32.
- Base OLED casi negra, con un único acento celeste en controles, títulos del hero y nombres.
- Campos de color de página completa, cada uno con su propia tinta.
- Dos voces tipográficas: píxel para nombrar y actuar, Atkinson para leer.
- Profundidad reservada a los objetos; las bandas son planas.
- Toda simulación queda rotulada en pantalla.

## Colors

La paleta es la de la pantalla de Pixie, más dos campos de color que marcan el paso del día.

### Primary
- **Celeste Píxel** (#9cd3ff): el color de los píxeles prendidos en el canvas. En la página es el botón de descarga, el título del hero, la marca, los nombres de las IA, los números de los pasos, el chevron de las preguntas, el foco y la selección de texto. También es campo de color en el momento de la tarde y en el cierre.
- **Celeste Destello** (#c4e5ff): relleno del botón principal en hover.
- **Tinta Hielo** (#06121f): texto sobre celeste. En el cierre invierte el botón y pasa a ser su relleno, con hover en #12263c.

### Secondary
- **Ámbar Mañana** (#f4b968): campo de color de la mañana y fondo mientras carga la escena. Su único uso fuera de ese campo es el contorno que señala qué tocar en la recreación del aviso de Windows.
- **Tinta Ámbar** (#231504): texto sobre ámbar.

### Tertiary
- **Azul Noche** (#121a3d): campo de color de la noche, con texto en Papel Frío de Pantalla.

### Neutral
- **Negro OLED** (#04060a): fondo de la página, del encabezado fijo y de la pantalla.
- **Marco** (#141922): el marco del dispositivo y la banda de las IA. También es el pulgar de la barra de scroll.
- **Píxel Apagado** (#0c131c): la grilla de puntos apagados del canvas, solo visible cuando cada píxel mide 5 px físicos o más.
- **Línea Hielo** (rgba(156, 211, 255, 0.2)): todos los bordes finos y divisores de la página.
- **Tinte Hielo** (rgba(156, 211, 255, 0.1)): relleno del pedido activo.
- **Papel Frío de Pantalla** (#e6edf7): texto principal sobre fondos oscuros.
- **Gris Secundario** (#a3afc2): notas, descripciones y enlaces del encabezado y del pie.
- **Superficie de Respuesta** (rgba(13, 17, 24, 0.96)): burbuja de respuesta de Pixie.
- **Barra de Tareas** (rgba(4, 6, 10, 0.88)): barra inferior del escritorio simulado.
- **Papel de Apuntes** (#f7f9fc) y **Tinta de Apuntes** (#1b2430): la ventana de apuntes del escritorio simulado, con línea #dde3ea y título #566273.

### Named Rules
**The Same Pixels Rule.** La cara se dibuja con el celeste y el negro de la app, y la página los toma de ahí. El color de la marca es el color del hardware.

**The Field With Its Ink Rule.** Ámbar, noche y celeste funcionan como campos de página completa, cada uno con su tinta. Ámbar y noche no aparecen como acentos sueltos en botones, títulos o enlaces.

**The Replica Is Not Palette Rule.** El azul #0a5fb0 y el blanco del aviso de Windows copian al sistema operativo. Viven solo en esa recreación y no se usan en otra parte.

## Typography

**Display Font:** Pixelify Sans Variable (con Segoe UI y sans-serif de respaldo)
**Body Font:** Atkinson Hyperlegible Next Variable (con Segoe UI, system-ui y sans-serif de respaldo)

**Character:** Pixelify Sans le presta a los títulos la voz de la pantalla, siempre a peso 600 y sin ligaduras. Atkinson hace lo contrario: desaparece para que las explicaciones sobre instalación y privacidad se lean sin fricción.

### Hierarchy
- **Display** (600, clamp(3.25rem, 7.2vw, 6rem), 1.05): solo «Pixie, ¿estás?», en celeste. Debajo de 900 px baja a clamp(2.75rem, 13vw, 4.5rem).
- **Display de cierre** (600, clamp(3rem, 8vw, 6rem), 1.05): «Acá estoy.», en tinta sobre el campo celeste.
- **Headline** (600, clamp(2.25rem, 5vw, 4rem), 1.05): títulos de sección, con `text-wrap: balance`. En los paneles apilados del día baja a clamp(2rem, 8vw, 3rem).
- **Title de nombre** (600, clamp(1.75rem, 3.5vw, 2.75rem), 1.1): nombres de las IA, en celeste.
- **Title** (600, 1.5rem, 1.05): títulos de los pasos de instalación. Los números de paso usan la misma fuente a 2.25rem, en celeste.
- **Acción** (600, 1.375rem): botón de descarga, a 1.25rem debajo de 900 px y a 1rem en la versión compacta. La marca del encabezado usa este mismo tamaño.
- **Body** (400, 1.0625rem, 1.55): texto corrido, con medidas de 30 a 44rem según el bloque. Las preguntas frecuentes usan 1.1875rem a 600.
- **Lead** (400, 1.1875rem, 1.55): bajadas de sección, en gris y con 40rem de medida. La bajada del hero va de 1.0625rem a 1.3125rem, y el texto de la escena del día usa 1.25rem.
- **Label** (400, 0.9375rem): pedidos de ejemplo, notas de descarga, navegación, pie y figcaption. La versión y el tamaño usan cifras tabulares.

### Named Rules
**The Two Voices Rule.** Pixelify nombra y actúa: títulos, marca, botones, nombres de IA y números de paso. Atkinson explica: toda oración que haya que leer va en Atkinson.

## Layout

La página es una columna continua de ancho completo: encabezado fijo de 3.75rem, hero, escena del día, bandas de contenido, cierre y pie. El margen lateral es un único valor fluido (spacing.gutter) y el contenido de las bandas se centra con un máximo de 76rem. Las bandas respiran con padding vertical basado en la altura de la ventana.

**Hero.** Ocupa la ventana menos el encabezado, con dos columnas (1fr y 1.25fr): título, bajada y botón a la izquierda, cara a la derecha alineada al borde, y los pedidos de ejemplo a todo el ancho debajo.

**Escena del día.** Con 900 px de ancho, 620 px de alto y movimiento permitido, la sección se fija a 100vh durante 280 % de scroll, ligada con un retardo de 0.4 s. La cara empieza a escala 3, desplazada hacia el centro, y se achica hasta su esquina inferior derecha; luego los campos se funden de ámbar a celeste y a noche, y el reloj de la barra pasa por 8:30, 15:10 y 23:40. Al final, la cara se duerme. Si no se cumple alguna de esas condiciones, los tres momentos se apilan como paneles de color, cada uno con su escritorio de 26rem de alto.

**Bandas.** Las bandas de privacidad, instalación y preguntas usan dos columnas con separación spacing.column. Los proveedores y las preguntas se listan como filas abiertas con divisor superior, sin tarjetas.

**Responsive.** Debajo de 900 px todo pasa a una columna: en el hero la cara va primero y el botón ocupa todo el ancho. Debajo de 640 px se ocultan los enlaces de sección del encabezado. Con poca altura, la bajada del hero se reduce a 1rem.

## Elevation & Depth

El sistema es plano por defecto. Las bandas se distinguen por cambio de fondo o por una línea fina, y las sombras aparecen solo en lo que se presenta como un objeto físico o una ventana. La profundidad mayor no es una sombra: es la capa de campos de color que se funden por opacidad detrás del escritorio.

### Shadow Vocabulary
- **Dispositivo** (`box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5)`): el marco grande en el hero y el cierre.
- **Dispositivo chico** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35)`): el marco en la esquina del escritorio.
- **Ventana de apuntes** (`box-shadow: 0 14px 34px rgba(4, 6, 10, 0.3)`): la ventana del escritorio simulado.
- **Ventana del sistema** (`box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45)`): la recreación del aviso de Windows.

### Named Rules
**The Objects Only Rule.** Tienen sombra el dispositivo y las ventanas. Botones, pedidos, burbujas y bandas no.

## Shapes

Las esquinas crecen con el tamaño del objeto: pantalla (4px), tecla (6px), botón compacto (9px), pedido y ventana de apuntes (10px), botón (12px), burbuja (14px), marco chico (18px) y marco grande (de 18px a 36px). La curva pertenece al plástico del dispositivo y a la interfaz; los píxeles de la cara se mantienen cuadrados, con `image-rendering: pixelated`. Los bordes son de 1px en Línea Hielo. La recreación del aviso de Windows es la excepción deliberada: va con esquinas rectas porque copia al sistema operativo.

## Components

### Buttons
Un solo botón, grande y físico, que dice qué baja.
- **Shape:** esquinas medianas (12px), 3.5rem de alto.
- **Primary:** relleno celeste, tinta hielo, Pixelify a 600 e ícono de descarga en SVG de 20px.
- **Hover / Focus:** el relleno se aclara en 160ms, solo en dispositivos con hover real. Al presionar escala a 0.97 en 120ms, salvo con movimiento reducido. El foco es un contorno celeste de 2px, separado 2px.
- **Compacto:** en el encabezado, con 2.75rem de alto, 9px de radio y texto de 1rem.
- **Cierre:** invierte el par sobre el campo celeste, y el contorno de foco pasa a tinta.
- **Fuera de Windows:** el botón copia el link para abrirlo en la compu, sin ofrecer el instalador, y la versión compacta desaparece. Debajo del botón siempre va una nota con versión, tamaño y sistema, y al tocar descargar aparece el anticipo del aviso de Windows.

### Chips
- **Style:** pedidos de ejemplo entre comillas latinas, sin relleno, con borde Línea Hielo, 10px de radio y 2.75rem de alto. El rótulo de arriba aclara que es una demo.
- **State:** en hover o activo el borde pasa a celeste; el activo suma Tinte Hielo. Se expresan con `aria-pressed`.

### Navigation
- **Style:** barra fija sobre Negro OLED con divisor inferior. Marca en Pixelify celeste con el logo de ojos; enlaces de sección en gris a 0.9375rem, que pasan a Papel Frío en hover; botón compacto al final. Cada destino mide al menos 2.75rem de alto.
- **Mobile:** debajo de 640 px quedan la marca y el botón compacto.

### Dispositivo
La firma del sistema. Marco de color Marco con borde Línea Hielo, y dentro un canvas de 64 × 32 que dibuja con `renderFace`. El tamaño de cada píxel es siempre un múltiplo entero, de 2 en adelante; desde 5 px físicos aparece la separación de 1 px y la grilla de píxeles apagados. La versión chica fija el ancho en 192 CSS px. Se dibuja a unos 30 cuadros por segundo, solo si está visible y la cara cambió, y con movimiento reducido queda quieta.

### Burbuja de respuesta
Lo que dice Pixie: superficie casi opaca, borde Línea Hielo, 14px de radio, 0.9375rem y hasta 19rem de ancho. En el hero entra con un ascenso de 6px en 200ms, solapada al borde inferior del marco.

### Escritorio simulado
Una ventana de apuntes en papel claro con barra de título, la cara en la esquina y una barra de tareas translúcida de 2.75rem. La barra lleva siempre el rótulo «Escena ilustrativa» a la izquierda y el reloj a la derecha, con cifras tabulares.

### Recreación del aviso de Windows
Dos ventanas azules rectas, con títulos «Primero» y «Después», y contornos ámbar de 2px sobre lo que hay que tocar. El pie aclara que es una recreación.

### Listas abiertas
Proveedores, pasos y preguntas son filas con divisor superior de Línea Hielo y 1.125rem de aire vertical, sin tarjetas. Los pasos numeran con el contador en Pixelify celeste. Las preguntas usan `details` nativo, con chevron SVG celeste que rota en 200ms.

## Do's and Don'ts

### Do:
- **Do** usar la cara real con `PixieScreen` cuando Pixie aparece viva en una superficie.
- **Do** mantener el canvas en múltiplos enteros de 64 × 32, con `image-rendering: pixelated`.
- **Do** rotular todo lo simulado dentro de la propia pieza, como «Escena ilustrativa», «demo con respuestas de ejemplo» o «Recreación del aviso de Windows».
- **Do** dar a cada campo de color su tinta: tinta hielo sobre celeste, tinta ámbar sobre ámbar y Papel Frío sobre noche.
- **Do** hacer que los controles midan al menos 2.75rem de alto.
- **Do** usar `cubic-bezier(0.23, 1, 0.32, 1)` en movimientos de entrada y respuesta, y 160ms para cambios de color.
- **Do** limitar los hover a `(hover: hover) and (pointer: fine)`.
- **Do** ofrecer con movimiento reducido una versión estática con el mismo contenido, como los paneles apilados del día.
- **Do** adaptar el contorno de foco al campo: celeste sobre oscuro, tinta sobre celeste.

### Don't:
- **Don't** reemplazar la cara viva por una captura o un video. El logo de ojos y la imagen para compartir sí son estáticos, porque son marca.
- **Don't** escalar el canvas a tamaños fraccionarios ni suavizar sus píxeles.
- **Don't** poner oraciones de lectura en Pixelify ni usarla a otro peso que no sea 600.
- **Don't** poner sombra en botones, pedidos, burbujas o bandas.
- **Don't** usar el azul del aviso de Windows ni el papel de apuntes como colores de la página.
- **Don't** mostrar una simulación sin rótulo.
