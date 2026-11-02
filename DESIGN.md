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
  ice-line: "rgba(156, 211, 255, 0.2)"
  ice-wash: "rgba(156, 211, 255, 0.09)"
  text: "#e6edf7"
  muted: "#a3afc2"
  aurora-blue: "rgba(74, 112, 196, 0.1)"
  aurora-periwinkle: "rgba(126, 140, 255, 0.13)"
  morning-deep: "#233a5c"
  morning-light: "#4a6f96"
  afternoon-deep: "#1a3b5c"
  afternoon-light: "#2f6a92"
  night-deep: "#0b1026"
  night: "#121a3d"
  top-glass: "rgba(4, 6, 10, 0.72)"
  reply-surface: "rgba(13, 17, 24, 0.96)"
  taskbar: "rgba(4, 6, 10, 0.88)"
  paper: "#f7f9fc"
  paper-ink: "#1b2430"
typography:
  display:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5.5rem)"
    fontWeight: 600
    lineHeight: 1.05
  clock:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "min(25vw, 48vh)"
    fontWeight: 600
    lineHeight: 1
  numeral:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "5rem"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.05
  title-name:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 600
    lineHeight: 1
  title-part:
    fontFamily: "Pixelify Sans Variable, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
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
  row: "1rem"
  button-x: "1.75rem"
  gutter: "clamp(1rem, 4vw, 3.5rem)"
  column: "clamp(2rem, 6vw, 6rem)"
  band: "clamp(4rem, 10vh, 7rem)"
  band-closing: "clamp(5rem, 14vh, 9rem)"
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
  button-compact-hover:
    backgroundColor: "{colors.ice-hover}"
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
    backgroundColor: "{colors.top-glass}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "0 clamp(1rem, 4vw, 3.5rem)"
    height: "3.75rem"
  day-clock:
    textColor: "{colors.ice}"
    typography: "{typography.clock}"
  desk-window:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 1rem 1rem"
    width: "20rem"
---

# Design System: Pixie

## Overview

**Creative North Star: "La pantallita encendida"**

El sistema sale de un objeto: la pantalla OLED de 64 por 32 píxeles que Pixie heredó de un reloj con ESP32. La página no ilustra ese objeto. Lo corre: el canvas usa el mismo código de dibujo y animación que la app, y la cara mira al puntero, pestañea y reacciona a lo que tocás. En el hero y el cierre los píxeles salen del marco y flotan sobre la oscuridad; el marco queda para cuando Pixie se presenta como dispositivo.

Todo lo demás es luz fría sobre negro. Detrás de la página hay una aurora azul hielo fija y muy tenue, y las secciones no tienen fondo propio: el contenido flota sobre esa capa. El único cambio grande de atmósfera es la escena del día, con degradados azules que se funden entre sí y una hora gigante casi transparente. La densidad es baja, con títulos grandes en Pixelify Sans y texto en Atkinson Hyperlegible Next, hecho para leerse sin esfuerzo.

Pixie no se queda en el hero: desde 900 px de ancho baja a la esquina de la ventana y acompaña el scroll comentando las secciones, igual que en el escritorio. La dirección rechaza el hero de texto más captura de producto: la cara ocupa ese lugar y funciona.

**Key Characteristics:**
- Una cara real en canvas como pieza central, en múltiplos enteros de su grilla de 64 × 32.
- Base OLED casi negra con aurora azul hielo fija; las secciones son transparentes.
- Un único acento celeste en controles, títulos grandes y nombres.
- Solo azules fríos: el color de fondo llega como luz o degradado, nunca como campo plano.
- Dos voces tipográficas: píxel para nombrar y actuar, Atkinson para leer.
- Pixie acompaña desde la esquina a partir de 900 px.
- Los bloques aparecen una vez, con fundido y desenfoque suave.
- Toda simulación queda rotulada en pantalla.

## Colors

La paleta es la de la pantalla de Pixie, extendida en una familia de azules fríos para la aurora y el paso del día.

### Primary
- **Celeste Píxel** (#9cd3ff): el color de los píxeles prendidos en el canvas. En la página es el relleno de los botones, el título del hero y del cierre, la marca, los nombres de las partes y de las IA, los números de los pasos, las líneas de la anatomía, el chevron de las preguntas, la hora gigante, el foco y la selección de texto.
- **Celeste Destello** (#c4e5ff): relleno de los botones en hover.
- **Tinta Hielo** (#06121f): texto sobre celeste, en los botones y la selección.

### Secondary
- **Aurora Azul** (rgba(74, 112, 196, 0.1)) y **Aurora Pervinca** (rgba(126, 140, 255, 0.13)): junto con Línea Hielo, que hace de núcleo luminoso, son los tonos de los cuatro focos difusos de la aurora. No se usan en otra parte.

### Tertiary
Los tres degradados del día corren a 170 grados, del tono profundo al claro, y llevan Papel Frío de Pantalla como texto.
- **Mañana** (#233a5c a #4a6f96): azul acero.
- **Tarde** (#1a3b5c a #2f6a92): azul más saturado.
- **Noche** (#0b1026 a #121a3d): azul casi negro.

### Neutral
- **Negro OLED** (#04060a): fondo de la página y de la pantalla, debajo de la aurora.
- **Marco** (#141922): el marco del dispositivo y el pulgar de la barra de scroll.
- **Píxel Apagado** (#0c131c): la grilla de puntos apagados del canvas con marco, solo visible cuando cada píxel mide 5 px físicos o más. La cara sin marco no la dibuja.
- **Línea Hielo** (rgba(156, 211, 255, 0.2)): todos los bordes finos y divisores de la página.
- **Velo Hielo** (rgba(156, 211, 255, 0.09)): la columna derecha de privacidad, un velo translúcido que deja ver la aurora.
- **Papel Frío de Pantalla** (#e6edf7): texto principal sobre fondos oscuros y sobre los degradados.
- **Gris Secundario** (#a3afc2): notas, bajadas, descripciones y enlaces del encabezado y del pie.
- **Vidrio Superior** (rgba(4, 6, 10, 0.72)): fondo del encabezado, con desenfoque de 10px.
- **Superficie de Respuesta** (rgba(13, 17, 24, 0.96)): burbuja de respuesta de Pixie.
- **Barra de Tareas** (rgba(4, 6, 10, 0.88)): barra inferior del escritorio simulado.
- **Papel de Apuntes** (#f7f9fc) y **Tinta de Apuntes** (#1b2430): la ventana de apuntes del escritorio simulado, con línea #dde3ea y título #566273.

### Named Rules
**The Same Pixels Rule.** La cara se dibuja con el celeste y el negro de la app, y la página los toma de ahí. El color de la marca es el color del hardware.

**The Cold Light Rule.** El color de fondo llega como luz o degradado azul: la aurora, los tres momentos del día y el velo de privacidad. No hay campos planos de color a página completa ni ámbar en la paleta.

**The Replica Is Not Palette Rule.** El azul #0a5fb0 y el blanco del aviso de Windows copian al sistema operativo. Viven solo en esa recreación y no se usan en otra parte.

## Typography

**Display Font:** Pixelify Sans Variable (con Segoe UI y sans-serif de respaldo)
**Body Font:** Atkinson Hyperlegible Next Variable (con Segoe UI, system-ui y sans-serif de respaldo)

**Character:** Pixelify Sans le presta a los títulos la voz de la pantalla, siempre a peso 600 y sin ligaduras. Atkinson hace lo contrario: desaparece para que las explicaciones sobre instalación y privacidad se lean sin fricción.

### Hierarchy
- **Reloj** (600, min(25vw, 48vh), 1): la hora gigante de la escena fijada, en celeste a 16 % de opacidad y arriba a la derecha. Es decorativa; la hora legible está en la barra de tareas.
- **Display** (600, clamp(2.5rem, 6vw, 5.5rem), 1.05): «Pixie, ¿estás?» y «Acá estoy.», en celeste. El título del hero va en una línea y debajo de 900 px baja a clamp(2.5rem, 12vw, 4rem).
- **Numeral** (600, 5rem, 1): números de los pasos de instalación, en celeste.
- **Title de nombre** (600, clamp(2.5rem, 6vw, 5rem), 1): nombres de las IA, en celeste.
- **Headline** (600, clamp(2.25rem, 5vw, 4rem), 1.05): títulos de sección, con `text-wrap: balance`. En los paneles apilados del día baja a clamp(2rem, 8vw, 3rem).
- **Title de parte** (600, 2rem, 1.05): partes de la anatomía, en celeste.
- **Title** (600, 1.5rem, 1.05): títulos de los pasos de instalación.
- **Acción** (600, 1.375rem): botón de descarga, a 1.25rem debajo de 900 px y a 1rem en la versión compacta. La marca del encabezado usa este mismo tamaño.
- **Body** (400, 1.0625rem, 1.55): texto corrido, con medidas de 28 a 44rem según el bloque. Las preguntas frecuentes usan 1.1875rem a 600.
- **Lead** (400, 1.1875rem, 1.55): bajadas de sección, en gris y con 40rem de medida. La bajada del hero va de 1.0625rem a 1.3125rem, y el texto de la escena del día usa 1.25rem.
- **Label** (400, 0.9375rem): notas de descarga, navegación, burbuja, pie y figcaption. La versión y el tamaño usan cifras tabulares.

### Named Rules
**The Two Voices Rule.** Pixelify nombra y actúa: títulos, marca, botones, nombres, números y la hora gigante. Atkinson explica: toda oración que haya que leer va en Atkinson.

## Layout

La página es una columna continua de ancho completo sobre la aurora: encabezado pegado arriba de 3.75rem, hero, escena del día, anatomía, IA, privacidad, instalación, preguntas, cierre y pie. El margen lateral es un único valor fluido (spacing.gutter). Las secciones ocupan todo el ancho, salvo la anatomía, que se centra con un máximo de 80rem. Respiran con padding vertical basado en la altura de la ventana (spacing.band).

**Hero.** Ocupa la ventana menos el encabezado, con un mínimo de 32rem, en dos columnas iguales alineadas al centro: título, bajada y botón a la izquierda, y la cara sin marco a la derecha, centrada y de hasta 34rem.

**Cierre.** Reutiliza el hero en una columna centrada, con la cara arriba, de hasta 22rem, y padding spacing.band-closing.

**Escena del día.** Con 900 px de ancho, 620 px de alto y movimiento permitido, la sección se fija a 100vh durante 280 % de scroll, ligada con un retardo de 0.4 s. Los degradados se funden de mañana a tarde y a noche, los textos cambian abajo a la izquierda, y la hora pasa por 8:30, 15:10 y 23:40. Pixie no vive dentro de la escena: la acompaña la de la esquina, que dice una frase por momento y se duerme al final. La ventana de apuntes aparece desde 1280 px. Si no se cumple alguna de las condiciones, los tres momentos se apilan como paneles con degradado, cada uno con su escritorio de 26rem de alto, su Pixie con marco y su burbuja, sin hora gigante.

**Anatomía.** Un escenario de proporción 5:3 con la cara con marco en el centro y cinco partes alrededor, con líneas de 2px que terminan en un píxel cuadrado de 10px. Al pasar el puntero por una parte, la cara reacciona.

**IA.** Dos columnas (1fr y 1.5fr), con el título fijo al scrollear y los proveedores en escalera, cada uno 8 % más a la derecha que el anterior.

**Privacidad.** Dos columnas iguales de borde a borde, sin separación: lo que queda en tu compu a la izquierda y lo que viaja a la IA a la derecha, sobre Velo Hielo.

**Instalación y preguntas.** Instalación usa dos columnas (1fr y 1.1fr), con los pasos a la izquierda y los avisos de Windows superpuestos a la derecha. Preguntas usa 1fr y 1.4fr, con el título fijo al scrollear.

**Responsive.** Debajo de 1100 px la anatomía se apila sin líneas. Debajo de 900 px todo pasa a una columna: en el hero el texto va primero y la cara, de hasta 20rem, después; en el cierre la cara sigue arriba. El botón ocupa todo el ancho, la escalera se aplana, los títulos dejan de quedar fijos y la Pixie de la esquina no aparece. Debajo de 640 px se ocultan los enlaces de sección del encabezado.

## Elevation & Depth

La profundidad viene por capas de luz y no por sombras. En el fondo está la aurora, fija. Sobre ella flota el contenido sin superficies propias, y la cara del hero y del cierre sube y baja 7px en un ciclo de 7 s. En la escena del día, la profundidad es la capa de degradados que se funden por opacidad y la hora gigante detrás de la ventana. Arriba de todo quedan la Pixie de la esquina y el encabezado, que deja pasar la página desenfocada. Las sombras aparecen solo en lo que se presenta como un objeto físico o una ventana.

### Shadow Vocabulary
- **Dispositivo** (`box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5)`): el marco grande de la anatomía.
- **Dispositivo chico** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35)`): el marco de la Pixie de la esquina y de los paneles del día.
- **Ventana de apuntes** (`box-shadow: 0 14px 34px rgba(4, 6, 10, 0.3)`): la ventana del escritorio simulado.
- **Ventana del sistema** (`box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45)`): la recreación del aviso de Windows.

### Named Rules
**The Objects Only Rule.** Tienen sombra el dispositivo y las ventanas. Botones, burbujas y secciones no. La cara sin marco tampoco: son píxeles de luz, no un objeto.

## Shapes

Las esquinas crecen con el tamaño del objeto: pantalla (4px), tecla (6px), botón compacto (9px), ventana de apuntes (10px), botón (12px), burbuja (14px), marco chico (18px) y marco grande (de 18px a 36px). La curva pertenece al plástico del dispositivo y a la interfaz; los píxeles de la cara se mantienen cuadrados, con `image-rendering: pixelated`, y los remates de las líneas de la anatomía repiten ese cuadrado. Los bordes son de 1px en Línea Hielo. La recreación del aviso de Windows es la excepción deliberada: va con esquinas rectas porque copia al sistema operativo.

## Components

### Buttons
Un solo botón, grande y físico, que dice qué baja.
- **Shape:** esquinas medianas (12px), 3.5rem de alto.
- **Primary:** relleno celeste, tinta hielo, Pixelify a 600 e ícono de descarga en SVG de 20px. Es igual en el hero y en el cierre.
- **Destello:** un brillo blanco recorre el borde de 2px del botón en una vuelta de 3.5 s. Lo llevan solo los dos botones de descarga principales, y se apaga con movimiento reducido.
- **Hover / Focus:** el relleno se aclara en 160ms, solo en dispositivos con hover real. Al presionar escala a 0.97 en 120ms, salvo con movimiento reducido. El foco es un contorno celeste de 2px, separado 2px.
- **Compacto:** en el encabezado, con 2.75rem de alto, 9px de radio, texto de 1rem y sin destello.
- **Fuera de Windows:** el botón copia el link para abrirlo en la compu, sin destello y sin ofrecer el instalador, y la versión compacta desaparece. Debajo del botón principal siempre va una nota con versión, tamaño y sistema, y al tocar descargar aparece el anticipo del aviso de Windows.

### Navigation
- **Style:** barra pegada arriba, de vidrio oscuro desenfocado, con divisor inferior. Marca en Pixelify celeste con el logo de ojos; enlaces de sección en gris a 0.9375rem, que pasan a Papel Frío en hover; botón compacto al final. Cada destino mide al menos 2.75rem de alto.
- **Mobile:** debajo de 640 px quedan la marca y el botón compacto.

### Cara sin marco
La firma del sistema, en el hero y el cierre. El canvas va sin marco, sin fondo y sin grilla apagada, así que solo se ven los píxeles prendidos sobre la aurora, y flota de forma continua, salvo con movimiento reducido. En el hero arranca con la animación de encendido y reacciona al acercarte al botón y al tocarlo. En el cierre se despierta al entrar en pantalla, y el botón le provoca las mismas reacciones.

### Dispositivo
Marco de color Marco con borde Línea Hielo, y dentro un canvas de 64 × 32 que dibuja con `renderFace`. El tamaño de cada píxel es siempre un múltiplo entero, de 2 en adelante; desde 5 px físicos aparece la separación de 1 px y la grilla de píxeles apagados. La versión chica fija el ancho en 192 CSS px, y la de la esquina en 128. Se dibuja a unos 30 cuadros por segundo, solo si está visible y la cara cambió, y con movimiento reducido queda quieta.

### Pixie de la esquina
Desde 900 px de ancho, un dispositivo chico fijo abajo a la derecha, encima del contenido y debajo del encabezado. Baja desde el centro mientras se scrollea el hero, de escala 2.4 a 1, y se oculta con un fundido de 200ms mientras se ve más de un 35 % del hero o del cierre. Dice una frase al llegar a cada sección y reacciona con ella; la burbuja dura 5 s. Al tocarla saluda. Con movimiento reducido se queda quieta en la esquina.

### Burbuja de respuesta
Lo que dice Pixie: superficie casi opaca, borde Línea Hielo, 14px de radio, 0.9375rem y hasta 19rem de ancho. En la esquina entra con un ascenso de 6px y una escala de 0.97 a 1 en 200ms.

### Hora gigante
Los dígitos del momento en Pixelify, en celeste a 16 % de opacidad, ocupando la zona superior derecha de la escena fijada. Cambian de golpe entre momentos y quedan ocultos para lectores de pantalla.

### Escritorio simulado
Sobre el degradado del momento, una ventana de apuntes en papel claro con barra de título y una barra de tareas translúcida de 2.75rem. La barra lleva siempre el rótulo «Escena ilustrativa» a la izquierda y el reloj a la derecha, con cifras tabulares.

### Recreación del aviso de Windows
Dos ventanas azules rectas y superpuestas, marcadas «Primero» y «Después», con contornos blancos de 2px sobre lo que hay que tocar. El pie aclara que es una recreación.

### Listas abiertas
Proveedores, pasos y listas de privacidad son filas abiertas, sin tarjetas. Privacidad y preguntas separan con un divisor superior de Línea Hielo; proveedores y pasos se ordenan solo por tamaño y aire. Los pasos numeran con el contador en Numeral. Las preguntas usan `details` nativo, con chevron SVG celeste que rota en 200ms.

### Apariciones
Los bloques de anatomía, IA, instalación y preguntas entran una sola vez, cuando un 25 % asoma en pantalla: fundido, desenfoque de 6px a 0 y ascenso de 14px en 550ms, con 60 a 70ms de escalón entre elementos de una lista. Con movimiento reducido queda solo el fundido. El hero tiene su propia entrada, sin desenfoque: ascenso de 14px en 600ms, con retardos de hasta 150ms.

## Do's and Don'ts

### Do:
- **Do** usar la cara real con `PixieScreen` cuando Pixie aparece viva en una superficie.
- **Do** usar la cara sin marco en los momentos grandes, y el dispositivo cuando Pixie se presenta como objeto o vive en la esquina.
- **Do** mantener el canvas en múltiplos enteros de 64 × 32, con `image-rendering: pixelated`.
- **Do** dejar que la aurora se vea: las secciones van sin fondo propio o con un velo translúcido.
- **Do** rotular todo lo simulado dentro de la propia pieza, como «Escena ilustrativa» o «Recreación del aviso de Windows».
- **Do** poner Papel Frío de Pantalla sobre los degradados azules y Tinta Hielo sobre celeste.
- **Do** hacer que los controles midan al menos 2.75rem de alto.
- **Do** usar `cubic-bezier(0.23, 1, 0.32, 1)` en movimientos de entrada y respuesta, y 160ms para cambios de color.
- **Do** limitar los hover a `(hover: hover) and (pointer: fine)`.
- **Do** ofrecer con movimiento reducido una versión quieta con el mismo contenido: aurora detenida, cara sin flotar, botón sin destello y paneles apilados.

### Don't:
- **Don't** reemplazar la cara viva por una captura o un video. El logo de ojos y la imagen para compartir sí son estáticos, porque son marca.
- **Don't** escalar el canvas a tamaños fraccionarios ni suavizar sus píxeles.
- **Don't** poner oraciones de lectura en Pixelify ni usarla a otro peso que no sea 600.
- **Don't** usar campos planos de color a página completa ni volver al ámbar.
- **Don't** poner sombra en botones, burbujas o secciones, ni en la cara sin marco.
- **Don't** usar el azul del aviso de Windows ni el papel de apuntes como colores de la página.
- **Don't** mostrar una simulación sin rótulo.
- **Don't** extender el destello más allá de los botones de descarga principales.

## Composición de la página

- **Fondo:** aurora azul hielo fija detrás de toda la página. Basada en Aurora Background de 21st.dev.
- **Inicio:** la pregunta ocupa la pantalla en diagonal: «Pixie,» arriba a la izquierda y «¿estás?» abajo a la derecha. Pixie contesta «Acá estoy.» arriba a la derecha, y el texto y el botón ocupan el hueco abajo a la izquierda. Una fila de datos cierra la sección.
- **Un día con Pixie:** escena fijada con la línea del día arriba, de 8:30 a 23:40. El monitor recorre la pantalla y cada momento compone distinto: a la mañana, texto a la izquierda y monitor a la derecha; a la tarde, al revés; a la noche, monitor centrado y texto debajo. Las ventanas y Pixie también cambian de lugar dentro del monitor.
- **Pixie en la esquina:** desde 900 px de ancho acompaña el resto de la página y comenta cada sección; se oculta donde ya hay una cara grande.
- **Anatomía, IA en escalera, privacidad en dos columnas y avisos de Windows superpuestos.**
- **Cierre:** cara, «Acá estoy.» y botón, centrados.
- **Apariciones:** los bloques entran una vez al scrollear, con fundido y desenfoque suave. El botón principal tiene un destello basado en Shimmer Button de 21st.dev.
