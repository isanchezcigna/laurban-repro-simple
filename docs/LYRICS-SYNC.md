# 🎯 Sincronización de Letras con Azura Stats

## ✨ Nueva Funcionalidad: Sincronización Perfecta

El sistema de letras ahora se sincroniza automáticamente con el tiempo real de reproducción que reporta Azura, garantizando que las letras aparezcan exactamente cuando deben, incluso si te unes a mitad de la canción.

## 🔄 Cómo Funciona

### 1. **Tiempo Virtual con Compensación de Latencia Adaptativa**

En lugar de usar el tiempo del stream de audio (que es continuo), el sistema usa:
- **`elapsed`**: Tiempo transcurrido de la canción según Azura
- **`duration`**: Duración total de la canción
- **Timestamp de inicio**: Se calcula cuando se detecta el cambio de canción
- **🆕 Delay adaptativo**: 
  - **Desktop/Android**: 1.5 segundos
  - **iPhone/iPad**: 4.5 segundos (Safari tiene buffer más agresivo)

### 2. **Cálculo de Sincronización**

```javascript
TiempoActual = TiempoInicial + (TimestampActual - TimestampInicio) - DelayStream
```

Ejemplo:
- Azura dice: "La canción lleva 45 segundos"
- Sistema carga letras con offset de 45s
- Resta 1 segundo de delay del stream
- Letras empiezan desde el segundo 44
- Se actualizan cada 100ms para precisión máxima

### 3. **Detección Automática de Cambios**

Cada 5 segundos, el sistema:
1. Consulta la API de Azura
2. Compara el ID de la canción actual
3. Si cambió:
   - Captura `elapsed` (tiempo transcurrido)
   - Busca letras en LRCLIB
   - Las sincroniza desde el segundo exacto

## 🧪 Pruebas

### Prueba Básica
```javascript
searchCurrentSongLyrics()
```
Verás en consola:
```
🔍 Buscando letras para: [Artista] - [Título]
⏱️ Tiempo: 45.23s / 180s
✅ Letras cargadas: 56 líneas (inicio en 45.23s)
🎤 LETRAS SINCRONIZADAS
Sincronizadas desde el segundo 45.23 de la canción
```

### Verificar Sincronización
```javascript
// Ver tiempo actual de la canción
state.lyricsManager.getCurrentTime()

// Ver datos de la canción
console.log('Elapsed:', state.songElapsed)
console.log('Duration:', state.songDuration)
console.log('Start Time:', new Date(state.songStartTime))
```

### Ajustar Delay de Sincronización

Si notas que las letras aparecen muy pronto o muy tarde, puedes ajustar el delay:

```javascript
// Ver delay actual (por defecto 1.0 segundo)
getLyricsDelay()

// Ajustar a 1.5 segundos si las letras aparecen muy pronto
setLyricsDelay(1.5)

// Ajustar a 0.5 segundos si las letras aparecen muy tarde
setLyricsDelay(0.5)

// Después de ajustar, recargar las letras
searchCurrentSongLyrics()
```

## 📊 Datos de Azura

La API de Azura devuelve:
```json
{
  "now_playing": {
    "song": {
      "id": "12345",
      "artist": "Bad Bunny",
      "title": "Tití Me Preguntó"
    },
    "duration": 223,
    "elapsed": 45
  }
}
```

El sistema usa:
- **`id`**: Para detectar cambios de canción
- **`duration`**: Duración total (para búsqueda en LRCLIB)
- **`elapsed`**: Tiempo transcurrido (para sincronización)

## 🎨 Ventajas del Sistema

### ✅ Sincronización Perfecta
- Las letras aparecen exactamente cuando deben
- No importa si te unes a mitad de canción
- Compensación automática de delay del stream

### ✅ Precisión Alta
- Actualización cada 100ms
- Cálculo basado en timestamps reales
- No depende del tiempo del elemento `<audio>`

### ✅ Recuperación Automática
- Si pierdes sincronización, al siguiente update se corrige
- El sistema re-sincroniza cada 5 segundos

### ✅ Sin Latencia Acumulada
- No se acumula error con el tiempo
- Cada update recalibra la posición

## 🔧 Casos de Uso

### Caso 1: Usuario entra a mitad de canción
```
1. Usuario abre el reproductor
2. Azura dice: "Canción en segundo 67"
3. Sistema busca letras
4. Letras inician desde el segundo 67
5. ✅ Sincronización perfecta
```

### Caso 2: Cambio de canción
```
1. Canción A termina
2. Empieza Canción B
3. Sistema detecta cambio de ID
4. Azura dice: "Canción en segundo 0"
5. Se cargan letras nuevas desde el inicio
6. ✅ Transición suave
```

### Caso 3: Pérdida de sincronización
```
1. Usuario pausa navegador por 30s
2. Al volver, el stream sigue
3. Próximo update (máx 5s)
4. Sistema recalcula con nuevo elapsed
5. ✅ Se recupera automáticamente
```

## 📝 Logs en Consola

El sistema muestra información detallada:

```
🔍 Buscando letras para: Artista - Título
⏱️ Tiempo transcurrido: 45.23s de 180s
✅ Letras cargadas: 56 líneas (inicio en 45.23s)
🎤 LETRAS SINCRONIZADAS
Sincronizadas desde el segundo 45.23 de la canción
```

## 🐛 Debug

### Ver estado interno
```javascript
// Estado del gestor de letras
state.lyricsManager.useVirtualTime  // true si usa tiempo virtual
state.lyricsManager.timeOffset      // Offset inicial (elapsed)
state.lyricsManager.songStartTimestamp  // Timestamp de inicio

// Datos de la canción
state.songElapsed    // Último elapsed conocido
state.songDuration   // Duración total
state.songStartTime  // Timestamp calculado de inicio

// Tiempo actual calculado
state.lyricsManager.getCurrentTime()
```

### Forzar recarga con nuevo offset
```javascript
// Simular que la canción lleva 60 segundos
const demoLyrics = LyricsManager.getDemoLyrics();
state.lyricsManager.loadLyrics(demoLyrics, 60);
```

## 🚀 Mejoras Futuras Posibles

1. **Ajuste de Latencia del Stream**
   - Detectar delay entre Azura y el audio real
   - Compensar automáticamente

2. **Predicción de Letras**
   - Pre-cargar siguiente línea
   - Transiciones más suaves

3. **Calibración Manual**
   - Permitir al usuario ajustar offset
   - Guardar preferencia por canción

4. **Detección de Desincronización**
   - Alertar si hay más de 2s de diferencia
   - Auto-corrección agresiva

## 💡 Notas Técnicas

### Precisión del Sistema
- **Resolución temporal**: 100ms (10 actualizaciones/segundo)
- **Precisión esperada**: ±200ms
- **Latencia del stream**: Variable (~2-5 segundos)

### Limitaciones
- La precisión depende de la exactitud de Azura
- El stream puede tener delay vs tiempo real de Azura
- LRCLIB debe tener letras con timestamps precisos

### Optimizaciones
- Intervalo de 100ms balancea precisión vs CPU
- Se usa `Date.now()` en lugar de `performance.now()` por simplicidad
- Limpieza automática de intervalos al cambiar canción

---

**🎵 Sistema implementado y listo para rock!**
