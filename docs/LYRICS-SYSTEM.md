# Sistema de Letras Sincronizadas - La Urban

## 🎵 Características

- Letras sincronizadas que aparecen automáticamente sobre el cover
- Animaciones suaves de entrada y salida
- Muestra la línea actual y la anterior
- Formato LRC compatible
- Integración automática con Azura Cast
- Búsqueda silenciosa: si no hay letras, simplemente no aparecen (sin errores)
- Auto-limpieza al cambiar de canción

## 🤖 Funcionamiento Automático

El sistema funciona **completamente automático**:

1. **Detección Automática**: Cuando cambia de canción, el sistema detecta el cambio
2. **Limpieza Inmediata**: Limpia las letras de la canción anterior
3. **Búsqueda Silenciosa**: Busca letras de la nueva canción en LRCLIB
4. **Sincronización Perfecta**: Si encuentra letras, las sincroniza con el tiempo transcurrido (incluyendo compensación de 1.5s de delay del stream)
5. **Visualización Elegante**: Las letras aparecen sobre el cover con animaciones suaves

**Si no encuentra letras**: El cover queda limpio sin oscurecimiento. No se muestran errores.

## 🚀 Cómo Probar Manualmente

### Opción 1: Buscar Letras de la Canción Actual

Abre la consola del navegador (F12) y ejecuta:

```javascript
searchCurrentSongLyrics()
```

Esto buscará manualmente las letras de la canción actual. A diferencia de la búsqueda automática, esta versión **muestra logs detallados** para debugging.

### Opción 2: Letras de Demostración

```javascript
loadDemoLyrics()
```

Luego reproduce el audio y verás las letras aparecer sobre el cover cada 3 segundos.

### Opción 3: Letras Personalizadas (Formato LRC)

```javascript
loadLyricsFromLRC(`
[00:12.00]Esta es la primera línea
[00:17.20]Segunda línea de la canción
[00:21.10]Y aquí va la tercera
[00:25.50]Cuarta línea con ritmo
[00:29.80]Quinta línea final
`)
```

### Opción 4: Letras desde Array

```javascript
// Crear un array personalizado
const misLetras = [
    { time: 5, text: "Primera línea a los 5 segundos" },
    { time: 10, text: "Segunda línea a los 10 segundos" },
    { time: 15, text: "Tercera línea a los 15 segundos" }
];

// Cargar las letras
state.lyricsManager.loadLyrics(misLetras);
```

### Limpiar Letras

```javascript
clearLyrics()
```

### Buscar Letras de la Canción Actual

```javascript
searchCurrentSongLyrics()
```

## 🔄 Sincronización Automática

El sistema ahora busca letras automáticamente cuando cambia la canción. Si encuentra letras sincronizadas en LRCLIB, las cargará y mostrará sobre el cover.

Para activar/desactivar esta función, simplemente el sistema detecta automáticamente cuando cambia el ID de la canción y busca las letras correspondientes.

## 📝 Formato LRC

El formato LRC es el estándar para letras sincronizadas:

```
[mm:ss.xx]Texto de la línea
```

Ejemplo:
```
[00:12.00]Cuando salí de Cuba
[00:15.30]Dejé mi vida, dejé mi amor
[00:19.50]Cuando salí de Cuba
[00:23.00]Dejé enterrado mi corazón
```

## 🔌 Integración con APIs

### Ejemplo con LRCLIB (Gratis)

```javascript
async function cargarLetrasDesdeAPI(artista, titulo) {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(titulo)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.syncedLyrics) {
            loadLyricsFromLRC(data.syncedLyrics);
            console.log('✅ Letras cargadas desde LRCLIB');
        } else {
            console.log('❌ No se encontraron letras sincronizadas');
        }
    } catch (error) {
        console.error('Error al cargar letras:', error);
    }
}

// Uso:
cargarLetrasDesdeAPI('Bad Bunny', 'Tití Me Preguntó');
```

### Ejemplo con Musixmatch

```javascript
// Requiere API Key de Musixmatch
async function cargarLetrasMusixmatch(trackId, apiKey) {
    const url = `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Procesar respuesta de Musixmatch y convertir a formato LRC
    // ...
}
```

## 🎨 Personalización CSS

Las letras tienen estas clases CSS que puedes modificar en `css/index.css`:

- `.lyrics-overlay` - Contenedor principal
- `.lyrics-line` - Cada línea de letra
- `.lyrics-line.active` - Línea actual (con animación)
- `.lyrics-line.previous` - Línea anterior (más pequeña y transparente)

## 📱 Responsive

El sistema es completamente responsive:
- En móviles: Fuente más pequeña (0.95rem)
- Siempre legible con sombras y fondos oscuros
- Animaciones optimizadas

## 🔧 API JavaScript

### LyricsManager

```javascript
// Acceso global
const lm = state.lyricsManager;

// Métodos disponibles
lm.loadLyrics(array)        // Cargar desde array
lm.loadFromLRC(string)      // Cargar desde formato LRC
lm.show()                   // Mostrar overlay
lm.hide()                   // Ocultar overlay
lm.clear()                  // Limpiar todo
```

## 💡 Tips

1. Las letras se sincronizan automáticamente con el audio
2. Si no hay letras, el overlay permanece oculto
3. Las animaciones son suaves y no afectan el rendimiento
4. Compatible con streams en vivo (solo necesitas los timestamps)

## 🐛 Debug

Para ver logs en consola:

```javascript
// Los logs automáticos ya están activos
// Busca mensajes como:
// ✨ LyricsManager inicializado
// 🎤 Letras de demostración cargadas
// Lyric displayed: "texto" at Xs
```

## 🎯 Próximos Pasos

Para implementar en producción:

1. Conectar con tu API de metadatos actual
2. Buscar letras cuando cambie la canción
3. Cargar letras automáticamente si están disponibles
4. Guardar en caché para evitar llamadas repetidas

Ejemplo de integración:

```javascript
// En tu función updateSongInfo()
async function updateSongInfo() {
    const data = await fetch(CONFIG.API_URL).then(r => r.json());
    
    // Actualizar título, artista, etc.
    // ...
    
    // Intentar cargar letras
    const artist = data.now_playing.song.artist;
    const title = data.now_playing.song.title;
    
    try {
        await cargarLetrasDesdeAPI(artist, title);
    } catch (error) {
        // Si no hay letras, simplemente no mostrar nada
        clearLyrics();
    }
}
```

## 📚 Recursos

- **LRCLIB**: https://lrclib.net/ (Gratis, sin API key)
- **Musixmatch**: https://developer.musixmatch.com/ (Requiere registro)
- **Genius**: https://docs.genius.com/ (Letras sin timestamps)
- **Formato LRC**: https://en.wikipedia.org/wiki/LRC_(file_format)

---

**Hecho con ❤️ para La Urban** 🎵
