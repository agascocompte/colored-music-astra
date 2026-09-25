# Colored Music / 02

[Abrir la aplicación](https://agascocompte.github.io/colored-music-astra/) · [Repositorio](https://github.com/agascocompte/colored-music-astra)

Una aplicación nueva de visualización musical: cinco universos WebGL y un plataformas 2D que se dirige con la música. Interfaz en español, archivos locales y una composición de demostración original de 96 segundos. Sin backend, cuentas ni claves.

## Arranque

Requiere Node.js 20.11 o posterior, compatible con Vite 6.

```sh
npm ci
npm run dev
```

Abre `http://127.0.0.1:5173`. Pulsa play para escuchar **Neon afterglow**, o carga/arrastra tus canciones. Los MP3 de referencia de `sounds/` son archivos locales opcionales y no se distribuyen con este repositorio.

```sh
npm run build
npm run preview
```

La aplicación estática de producción queda en `dist/`. `base: './'` permite servirla desde un subdirectorio. No abras `index.html` directamente mediante `file://`: los módulos y workers necesitan HTTP.

### Abrir desde otro PC

`127.0.0.1` siempre se refiere al equipo donde se abre el navegador. La vista previa inicial está servida únicamente en el PC de desarrollo; no es un despliegue público.

Para compartir la compilación en tu red local, ejecuta desde esta carpeta:

```sh
npm run build
npm run preview:lan
```

Desde el otro equipo abre `http://IP-DEL-PC-SERVIDOR:4174/`. En Windows puedes consultar la IPv4 de la conexión Ethernet/Wi-Fi con `ipconfig`. Ambos equipos deben tener conectividad entre sí, el proceso debe seguir abierto y el firewall debe permitir ese puerto en la red privada. El puerto 4174 evita interferir con la vista previa local de 4173. No se abre ninguna regla de firewall automáticamente.

La versión de Internet usa [GitHub Pages](https://agascocompte.github.io/colored-music-astra/). No requiere servidor de audio ni base de datos: cada visitante carga sus canciones en su propio navegador.

### Publicación automática

El workflow `.github/workflows/pages.yml` comprueba y compila cada actualización de `main`, y publica únicamente `dist/` mediante GitHub Actions. En Settings → Pages, la fuente de publicación debe ser **GitHub Actions**. También se puede lanzar manualmente desde Actions → Deploy to GitHub Pages → Run workflow. La configuración relativa de Vite permite cargar correctamente los scripts y el worker bajo `/colored-music-astra/`.

Para trabajar desde otro PC, clona este repositorio y ejecuta `npm ci` y `npm run dev`. Para usar la app basta con abrir el enlace de Pages; no necesitas instalar nada.

## Seis experiencias

| Universo     | Imagen                               | Relación con el audio                                                                              |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Resonance    | Filamentos de luz cobre y cian       | Espectro en las órbitas, graves en el radio, medios en la torsión, golpes en ondas expansivas      |
| Chromaflow   | Corrientes de materia líquida        | Graves y medios en los pliegues, agudos en los bordes, amplitud en la velocidad                    |
| Hyperdrive   | Carretera y horizonte retrofuturista | Terreno y horizonte espectrales, avance con la energía, iluminación con los golpes                 |
| Kaleidoscope | Mandala de cristales y polígonos     | Simetría modulada por graves y medios, brillo por bandas                                           |
| Stardust     | Campo estelar con profundidad        | Viaje impulsado por amplitud, partículas por agudos, ondas suaves y espaciadas por golpes marcados |
| Beat Runner  | Explorador sobre un camino luminoso  | Saltos espaciados, notas coleccionables, atracción por medios y brillo por agudos                  |

## Beat Runner

Un recorrido musical de **saltar y recoger notas**, sin combate ni controles manuales. El camino es continuo y las notas ya están repartidas por delante del personaje: una hilera baja para recoger corriendo y arcos ámbar para alcanzar en los saltos.

- **Golpes marcados → saltos:** un `beat` con ataque grave o impacto alto inicia el salto en ese mismo fotograma. Se exige suelo, al menos 0,95 s desde el salto anterior y 0,22 s desde el aterrizaje. No hay dobles saltos ni eventos en cola.
- **Graves → altura:** arcos completos de 52–92 unidades, con duración de 0,58–0,66 s. Los golpes intermedios iluminan el camino sin interrumpir el vuelo.
- **Intensidad → carrera:** velocidad suavizada, sin tirones en cada acento. En silencio se frena y se termina el salto en curso.
- **Medios → atracción:** las notas a menos de 66 unidades se acercan al personaje. Solo el contacto suma al contador; no se recogen objetos remotos.
- **Agudos → brillo:** destacan los coleccionables sin añadir movimientos bruscos al personaje.

El HUD muestra notas recogidas y saltos. Una mochila sustituye al arma. Se conservan paisaje, partículas y luz reactiva, con límites de objetos y reciclaje del mundo. La pausa congela la simulación. Las bandas espectrales son aproximaciones, no identificación de instrumentos.

## Audio y controles

Un único `HTMLAudioElement` alimenta `MediaElementAudioSourceNode → AnalyserNode → GainNode → destination`. El volumen no cambia los datos que dirigen las escenas. Se calcula RMS, bandas en Hz, espectro logarítmico, flujo espectral positivo, umbral adaptativo con varianza, periodos refractarios, una estimación de tempo y una envolvente de subida de intensidad. También se detectan ataques independientes en tres bandas, normalizados contra el nivel reciente de cada una: un grave sostenido no debe ocultar ataques medios/agudos más suaves. Sus envolventes rápidas controlan impulsos, barridos y destellos. No se identifica realmente cada instrumento: las etiquetas describen bandas, no una separación de batería. La detección es aproximada y causal, sin análisis previo de toda la canción.

La demo se sintetiza en un worker y se reproduce como WAV por la misma ruta de audio que los archivos locales. El director no conoce su partitura ni su tempo. Los sintetizadores, gráficos y sprites se han creado para este proyecto.

Controles: reproducción/pausa, progreso y búsqueda, volumen/silencio, anterior/siguiente, repetición, biblioteca de sesión, pantalla completa, selección de escenas y movimiento suave. Atajos: **espacio**, **1–6**, **F**, **M**. Se respetan los campos y diálogos al procesar atajos. Las preferencias de movimiento se guardan localmente y se respeta `prefers-reduced-motion` inicialmente.

Lectura acotada de título/artista ID3v2.3/v2.4 para MP3 sin flags especiales. Otros formatos usan el nombre del archivo. La decodificación disponible depende del navegador. Límite de 500 MB por archivo; la biblioteca dura la sesión. Los archivos nunca se suben a un servidor. Las fuentes de Google son opcionales y tienen alternativas del sistema.

## Estructura

```text
src/audio/        Reproducción, DSP, metadatos y sintetizador en worker
src/visuals/      Catálogo de escenas, shaders y renderer/fallback
src/game/         Director, simulación y dibujo Canvas independientes
src/main.js       Estado de la aplicación y conexión con la interfaz
src/style.css     Diseño adaptable, controles y accesibilidad
tests/            Pruebas de señal, simulación y navegador
docs/             Análisis de la versión antigua y decisiones
legacy/           Referencia local opcional, excluida del repositorio nuevo
sounds/           MP3 locales opcionales, excluidos del repositorio y la compilación
```

No hay dependencias de ejecución JavaScript. Vite, Playwright y Prettier son herramientas de desarrollo. WebGL usa un único programa y una textura de espectro reutilizada. Solo se dibuja la escena activa, se limita el tamaño del framebuffer, se reduce resolución si el ritmo de cuadros empeora y se deja de dibujar continuamente al pausar. Canvas ofrece un fallback para dispositivos sin WebGL; las versiones de compatibilidad de los cinco efectos son más sencillas.

## Validación

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run format:check
```

Para usar un Chromium ya instalado, establece `PLAYWRIGHT_CHROMIUM_EXECUTABLE` con su ruta antes de ejecutar las pruebas del navegador.

Las pruebas cubren análisis de audio, simulaciones de cuatro minutos a 30/60/120 fps, saltos espaciados en el instante del sonido, tiempo de carrera entre saltos, ausencia de impulsos en el aire o saltos en cola, recolección por proximidad, atracción local, pausa y silencio. Playwright comprueba los seis visualizadores, reproducción y carga de archivos, controles, errores, pantalla completa y diseño móvil. También reproduce tramos de Shots y RiseUp, comprueba que los saltos son menos del 60% de los golpes y que al menos el 30% del tiempo se pasa en el suelo, y registra recolecciones. Las pruebas de shaders comparan ataques con tiempo y RMS constantes. Las capturas se escriben en `test-results/`.

Comprobado en Chromium de escritorio con vistas de 1440 px y 390 px. Las pruebas de viewport móvil no sustituyen la verificación en hardware iOS/Android. El rendimiento depende de la GPU y de la resolución; no se promete una cifra universal de fps.

Consulta [el análisis y la arquitectura](docs/ARCHITECTURE.md) para conocer los cambios respecto al proyecto original.

La versión anterior se conserva en [agascocompte/colored-music](https://github.com/agascocompte/colored-music). Las pruebas de navegador que necesitan Shots o RiseUp se omiten automáticamente cuando esos archivos locales no están presentes.

## Biblioteca compartida y búsqueda

**Mi biblioteca → Mi colección** reúne la demo, las canciones compartidas y los archivos o fragmentos añadidos durante la sesión. Al abrir la app se consulta `https://agascocompte.github.io/colored-music-library/library.json`; los audios se reproducen desde `colored-music-library/sounds/`, sin copiarlos a Astra. La versión antigua también consume ese mismo catálogo.

Para mantener las canciones de las dos webs, modifica únicamente [library.json en colored-music-library](https://github.com/agascocompte/colored-music-library/blob/main/library.json): añade una entrada (`id`, `title`, `artist` opcional, `url`) y sube su archivo a `sounds/`, o retira su entrada para ocultarla de ambas bibliotecas. Tras publicarse Pages, basta recargar las aplicaciones. Astra no necesita un nuevo despliegue. Un fallo de conexión muestra un botón para reintentar y no bloquea la demo ni los archivos locales.

**Mi biblioteca → Buscar música** busca títulos y artistas mediante la API de iTunes. Los resultados ofrecen fragmentos de unos 30 segundos, atribución y enlace a la canción en la tienda; no son canciones completas. Se reproducen por streaming y se añaden una sola vez a la biblioteca de la sesión. No modifican el catálogo compartido. El servicio puede limitar peticiones o no disponer de determinados fragmentos.

Las búsquedas usan JSONP de iTunes, con cancelación, tiempo límite y caché de resultados en memoria. El elemento de audio usa CORS anónimo para que Web Audio pueda analizar también fuentes remotas. No se usa un proxy ni se necesitan claves. Referencia: [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html).
