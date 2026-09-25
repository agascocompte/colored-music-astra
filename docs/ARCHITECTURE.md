# Del prototipo a Colored Music / 02

## Análisis de la versión recibida

Se han revisado `index.html`, `README.md`, `src/sketch.js`, ambos managers, la clase base, el índice de visualizadores y las seis implementaciones. Las bibliotecas p5/p5.sound son dependencias vendorizadas; los siete MP3 son contenido de muestra preexistente.

La página cargaba p5, p5.sound y clases globales secuencialmente. `preload()` decodificaba siete canciones antes de iniciar. `AudioManager` almacenaba todos los `SoundFile`, un FFT con suavizado de 0.9 y un analizador de amplitud que las escenas no aprovechaban. La UI permitía reproducción, pausa, stop, anterior/siguiente, MP3 local y búsquedas de previews de 30 segundos en iTunes.

| Efecto antiguo        | Comportamiento                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Spiral                | Recorre una cuadrícula 11×11 en espiral y dibuja círculos cuyo tamaño/color depende de un espectro reducido tres veces            |
| Nebula                | Tres brazos de partículas orbitales, brillo por banda, núcleo grave y ondas al superar una diferencia de energía                  |
| VerticalLines / Pulse | 56 barras espectrales con muestreo no lineal, ataque/caída, tapas de pico con gravedad y reflejos                                 |
| Aurora                | Cinco cortinas por rangos de bins, estrellas, montañas y meteoros al detectar un incremento de energía                            |
| Rainbow               | Siete arcos por bandas con oscilaciones, gotas, glints y cambios de brillo                                                        |
| FlyingMesh            | Retícula 36×36 deformada por ruido y espectro, rotación, zoom y ondas; se dibuja en P2D pese al nombre y a variables de canvas 3D |

Los efectos más recientes ya tenían buenas ideas: ataque rápido/caída lenta, capas atmosféricas, energía por bandas y pulsos limitados. Sin embargo, cada efecto volvía a detectar beats con diferencias de energía y umbrales absolutos similares. Los rangos se expresaban como índices FFT, el tiempo aumentaba `0.016` por llamada y muchas velocidades eran incrementos por frame. La respuesta musical y la velocidad variaban con la tasa de refresco. La estimación de tempo de la clase base no alimentaba una coreografía común.

Otros límites observados:

- Canvas cuadrado con dimensiones globales y sin gestión completa de resize.
- Estado de pausa propio que podía divergir del audio: por ejemplo, `stop()` asignaba `paused = false`.
- La vista de canción se escribía cada frame y la transición a fin de pista no se gestionaba desde eventos del elemento de audio.
- Sin progreso, búsqueda temporal, volumen ni pantalla completa.
- El índice ES modules importaba clases sin exports aunque la aplicación real usaba scripts globales; era un camino de carga distinto y no operativo.
- Dependencias de UI por CDN, reproducción ligada a p5 y reglas especiales de iOS que añadían un segundo audio silencioso.
- No había plataformas, simulación ni pruebas automatizadas.

## Qué se conserva y qué cambia

Se conserva el concepto de biblioteca local, seis escenas intercambiables sin cortar el audio, asignación de bandas a comportamientos y envolventes de respuesta rápida con caída suave. Todo el código activo, el diseño, las escenas y el audio demo se han reescrito. La implementación anterior permanece en `legacy/` como referencia; no forma parte del bundle ni se mantiene como una segunda aplicación funcional. Los MP3 originales se conservan en `sounds/` y no se redistribuyen dentro de `dist/`.

La búsqueda de previews externos no se conserva: no era requisito de esta nueva versión y añadía dependencia de red, CORS y disponibilidad de terceros. La aplicación funciona con archivos del usuario y una composición propia. No se copia ningún sprite externo.

## Decisiones de arquitectura

**Módulos JavaScript y Vite.** El estado de la interfaz es pequeño. Un framework no aporta suficiente valor para justificar ejecución y complejidad adicionales. Los módulos separan UI, reproducción, extracción de características, dibujo y simulación. Vite 6 es compatible con el Node 20.11 encontrado en este entorno. Un lockfile fija las versiones instaladas.

**Web Audio nativo.** `AnalyserNode` expone espectro y dominio temporal sin modificar la señal. Se analiza antes del volumen para que la coreografía sobreviva a un cambio de escucha. La fuente multimedia permite buscar y reproducir ficheros largos sin decodificarlos enteros en un `AudioBuffer`. El contexto se abre/reanuda por interacción del usuario. [Documentación de AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode).

**WebGL directo.** Los cinco mundos abstractos son campos de color procedurales en shaders, sin descargar meshes, texturas o librerías de escena. La textura logarítmica se comparte y solo se pinta el modo seleccionado. El buffer se conserva para las miniaturas y las capturas, con límite de resolución para contener coste. Hay recuperación de contexto y fallback Canvas cuando no se puede inicializar WebGL.

**Canvas 2D y simulación separada para Beat Runner.** Recorrido de recolección sobre suelo continuo. Se conserva el detector compartido, pero el juego selecciona golpes marcados para iniciar saltos completos: `beat` con `lowHit` o `impact >= 0.78`, personaje en suelo, separación de 0,95 s y al menos 0,22 s tras aterrizar. Los eventos descartados no se encolan. El arco parabólico dura entre 0,58 y 0,66 s y su altura depende de los graves. La carrera sigue la intensidad con suavizado de 0,35 s. Los medios activan atracción local de notas y los agudos su brillo. No hay combate, enemigos ni acciones aéreas que sustituyan la trayectoria.

**Análisis causal compartido.** FFT 2048 sin suavizado previo; RMS y frecuencias en Hz; 128 muestras de espectro logarítmico; flujo espectral de incrementos de magnitud; umbral de media/varianza adaptativas; calentamiento y tiempos refractarios; envolventes de ataque/caída con deltas reales. Se añaden tres detectores de novedad independientes normalizados por su propia energía reciente. Así los ataques medios/agudos no dependen de superar la magnitud de un grave dominante. La estimación de BPM es orientativa, no una pista de beats perfecta ni un control maestro.

**Rendimiento y límites.** Buffers de análisis reutilizados, workers para síntesis inicial, escenarios inactivos sin render, partículas/objetos acotados, resolución adaptativa y pausa de trabajo visual en pestañas ocultas. El juego se conserva al cambiar de visualizador y se reinicia al cambiar de canción o buscar otra posición. No reconstruye determinísticamente toda la partida desde el inicio de la canción al buscar: inicia una nueva coreografía desde ese punto.

## Relación musical verificable

Las bandas y el estado musical vienen exclusivamente del audio reproducido. No se inyectan señales demo en el detector, ni hay una pista oculta de control. Las miniaturas sí se generan con una muestra estática ilustrativa antes de comenzar. En pausa se congela el tiempo, y en silencio no se disparan eventos musicales. El ambiente gráfico tiene geometría procedural determinista; los cambios de luz, velocidad y acciones tienen entradas auditables en las características del analizador.

Los tests de señal separan esta promesa de la apariencia: silencio y sostenidos no deben producir falsos golpes continuos; los transitorios periódicos deben generar eventos acotados. Los tests del juego evalúan también el caso sin beats y la estabilidad entre tasas de refresco. Playwright verifica que la conexión real entre reproductor, análisis, interfaz y canvas funciona en Chromium.

## Revisión de la respuesta musical

La versión contextual dejaba que los obstáculos eligieran las acciones y ocultaba su relación con el sonido. La siguiente revisión asignó cada golpe a un salto y las otras bandas a espada/esquiva: la sincronización era evidente, pero el resultado demasiado agitado y el combate sin objetivos resultaba incoherente.

La versión actual centra la escena en correr, saltar y recoger notas. Filtra la frecuencia de los saltos sin retrasarlos: un evento aceptado se ejecuta inmediatamente; los descartados siguen afectando a la iluminación. La trayectoria completa y el descanso sobre suelo evitan saltos encadenados en el aire. Se eliminan espada, esquiva y enemigos tanto de la simulación como del renderer.

Los coleccionables se generan por distancia antes de que llegue el personaje, con una fila baja y arcos elevados. Los medios atraen únicamente objetos cercanos, que deben alcanzar al personaje para sumar. El contador registra recogidas reales. Los agudos iluminan las notas; la intensidad suavizada regula el avance. Se mantienen la sombra en el suelo, el paisaje y el resto de visualizadores.

Las pruebas comprueban causalidad del salto, separación mínima, proporción de carrera, ausencia de impulsos en el aire y de saltos pendientes, recolección y límites de objetos a 30/60/120 fps. También reproducen la demo y tramos de Shots y Rise Up. La instrumentación de desarrollo con `?debug=1` es de lectura y no vuelve a muestrear el analizador. Los controles verifican comportamiento y estabilidad; la valoración audiovisual sigue siendo subjetiva.
