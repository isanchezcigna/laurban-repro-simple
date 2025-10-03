# 🎵 Sistema de Análisis de Audio - Visualizador del Logo

## 🎯 Objetivo

Crear un visualizador de audio que reaccione de forma **musical e inteligente**, donde el **kick/bombo marca el ritmo** y domina el movimiento del logo, perfecto para música urbana (reggaeton, trap, hip hop).

## 🔬 Análisis de Frecuencias Implementado

### **Configuración del Analizador**

```javascript
fftSize: 2048              // Alta resolución (1024 bins de frecuencia)
smoothingTimeConstant: 0.6 // Menos suavizado para captar transitorios
minDecibels: -90           // Rango dinámico amplio
maxDecibels: -10
```

### **Bandas de Frecuencia Analizadas**

| Banda | Rango (Hz) | Índices | Uso | Peso en Efecto |
|-------|-----------|---------|-----|----------------|
| **Sub-Bass** | 20-60 Hz | 0-5 | 🥁 **KICK/BOMBO** | ⭐⭐⭐⭐⭐ (Dominante) |
| **Bass** | 60-250 Hz | 6-20 | 🔊 808s, bajo | ⭐⭐⭐⭐ |
| **Low-Mids** | 250-500 Hz | 21-40 | 🥁 Snares, cuerpo | ⭐⭐⭐ |
| **Mids** | 500-2000 Hz | 41-160 | 🎤 Voces, melodías | ⭐⭐⭐ |
| **High-Mids** | 2000-4000 Hz | 161-320 | ✨ Presencia vocal | ⭐⭐ |
| **Highs** | 4000+ Hz | 321-480 | 🎩 Hi-hats, platillos | ⭐⭐ |

### **¿Por qué estas frecuencias?**

#### 🎵 **Para Música Urbana:**
- **Sub-Bass (20-60 Hz)**: Donde vive el kick/bombo
- **Bass (60-250 Hz)**: Los famosos 808s del trap/reggaeton
- **Mids (500-2000 Hz)**: Voces, que son protagonistas en el género
- **Highs (4000+ Hz)**: Hi-hats que marcan el ritmo secundario

## 🥁 Detección Inteligente de Kick

### **Algoritmo de Detección**

```javascript
// 1. Energía del kick = 70% sub-bass + 30% bass
kickEnergy = (subBass × 0.7) + (bass × 0.3)

// 2. Detección con threshold y tiempo mínimo
if (kickEnergy > 0.7 && timeSinceLastKick > 150ms) {
    // ¡KICK DETECTADO!
    kickScale = 1.25  // Escala dramática
    kickDecay = 1.0   // Inicia decay
}

// 3. Decay natural (rebote)
kickDecay *= 0.85  // Decay rápido pero suave
kickScale = 1.0 + (0.25 × kickDecay)
```

### **Parámetros de Detección**

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| `threshold` | 0.7 | Evita falsos positivos, solo kicks fuertes |
| `minTimeBetweenKicks` | 150ms | Evita doble detección (típico en música: 120-140 BPM) |
| `kickScale` | 1.25 | 25% más grande = impacto visual notable |
| `decayRate` | 0.85 | Rebote natural, no artificial |

## 📊 Estimación de BPM

### **Método de Análisis Temporal**

```javascript
// Historial de últimos 10 kicks
kickHistory = [t1, t2, t3, ..., t10]

// Calcular intervalos entre kicks
intervals = [t2-t1, t3-t2, ..., t10-t9]

// BPM promedio
avgInterval = sum(intervals) / length(intervals)
estimatedBPM = 60000 / avgInterval  // ms a BPM

// Ajustar efectos según BPM
if (80 <= BPM <= 160) {  // Rango típico de música urbana
    bpmMultiplier = 1.0 + ((BPM - 120) / 400)
}
```

### **Rango de BPM por Género**

| Género | BPM Típico | Comportamiento del Logo |
|--------|-----------|------------------------|
| Reggaeton | 90-100 | Movimiento moderado, "flow" |
| Trap | 130-150 | Movimiento rápido, agresivo |
| Hip Hop | 85-95 | Movimiento lento, "bounce" |
| Dembow | 95-110 | Movimiento constante, rítmico |

## 🎨 Efectos Visuales Aplicados

### **1. Escala (Transform Scale)**

```javascript
baseScale = 0.98 + (bass × 0.02)        // Pulsación base sutil
finalScale = baseScale × kickScale × bpmMultiplier
```

**Resultado:**
- 🔹 Sin kick: 0.98-1.00 (casi estático)
- 🔥 Con kick: 1.20-1.25 (¡BOOM!)

### **2. Rotación (Transform Rotate)**

```javascript
rotation = ((mid + highMid) / 2 - 0.5) × 8 × bpmMultiplier
```

**Resultado:**
- 🎤 Sigue las voces y melodías
- 🎵 Se amplifica con BPM más rápido
- 🌀 Rango: -4° a +4°

### **3. Brillo (Filter Brightness)**

```javascript
brightness = 1 + (highs × 0.2) + ((kickScale - 1) × 0.5)
```

**Resultado:**
- ✨ Hi-hats aumentan brillo sutilmente
- 💥 Kick produce flash de luz (hasta 1.5x)

### **4. Saturación (Filter Saturate)**

```javascript
avgEnergy = (subBass + bass + mid + highs) / 4
saturation = 1 + (avgEnergy × 0.4) + ((kickScale - 1) × 0.3)
```

**Resultado:**
- 🎨 Colores más vibrantes con energía alta
- 🔥 Kick intensifica colores dramáticamente

### **5. Sombra (Drop Shadow)**

```javascript
shadowIntensity = 15 + (bass × 20) + ((kickScale - 1) × 60)
shadowOpacity = 0.4 + (bass × 0.3) + ((kickScale - 1) × 0.5)
shadowColor = rgba(252, 94, 22, opacity)  // Naranja La Urban
```

**Resultado:**
- 💫 Sombra sutil base: 15px, opacidad 0.4
- 🔊 Con bass: hasta 35px, opacidad 0.7
- 🥁 **Con kick: hasta 75px, opacidad 0.9** ⭐ (El efecto más dramático)

### **6. Movimiento Vertical (TranslateY)**

```javascript
if (kickScale > 1.15) {  // Solo en kicks fuertes
    translateY = -((kickScale - 1) × 20)px
}
```

**Resultado:**
- 🚀 Logo "salta" hasta 5px hacia arriba en kicks fuertes
- 🎯 Efecto de "bounce" natural

## ⚡ Optimización de Performance

### **CSS Transitions**

```css
transition: transform 0.03s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            filter 0.05s ease-out;
```

- **30ms para transform**: Respuesta instantánea al kick
- **50ms para filter**: Suaviza cambios de color/brillo
- **Cubic-bezier custom**: "Snap" rápido, luego suave

### **Will-Change**

```css
will-change: transform, filter;
```

- GPU acceleration activada
- 60 FPS estables
- Menor carga en CPU

### **RequestAnimationFrame**

```javascript
requestAnimationFrame(animate)  // ~16.67ms (60 FPS)
```

- Sincronizado con refresh del monitor
- No desperdicia ciclos cuando está en background

## 📈 Comparativa de Métodos de Análisis

| Método | FFT Size | Smoothing | Pros | Contras | Uso |
|--------|----------|-----------|------|---------|-----|
| **Básico** | 256 | 0.8 | Simple, bajo CPU | Pierde detalles | ❌ No recomendado |
| **Estándar** | 512 | 0.7 | Balance | OK para pop/rock | ⚠️ Regular para urbana |
| **Implementado** | 2048 | 0.6 | Alta precisión, detecta kicks | Más CPU | ✅ **Óptimo para urbana** |
| **Ultra** | 4096 | 0.5 | Máxima precisión | CPU alto, overkill | ⚠️ Innecesario |

## 🎯 Resultado Final

### **Experiencia Visual:**

1. **🎵 Música tocando (sin kick)**
   - Logo late suavemente con el bass
   - Rota sutilmente con voces
   - Sombra naranja suave

2. **🥁 KICK DETECTADO**
   - ⚡ Logo escala instantáneamente a 1.25x
   - 🚀 Salta 3-5px hacia arriba
   - 💥 Flash de brillo (1.5x)
   - 🔥 Sombra explota a 75px
   - 🎨 Colores se saturan

3. **🌊 Después del kick (decay)**
   - Rebote natural de vuelta a tamaño normal
   - Efecto "gomoso" profesional
   - Todo en ~300ms

### **Sensación:**
- ✅ **El logo "baila" con la música**
- ✅ **El kick domina la animación** (como debe ser)
- ✅ **Respuesta instantánea** (no hay lag)
- ✅ **Movimiento natural** (no robótico)
- ✅ **Sincronizado con BPM** (se adapta al tempo)

## 🚀 Próximas Mejoras Posibles

1. **Detección de Snare/Clap** (250-500 Hz con transitorios)
2. **Visualización de espectro** (barras de frecuencia alrededor del logo)
3. **Colores reactivos** (hue shift según frecuencias)
4. **Partículas** (explotan en cada kick)
5. **Modo "festival"** (efectos más exagerados para EDM)

## 📚 Referencias

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Frequency Bands in Music](https://producerhive.com/music-production-recording-tips/audio-spectrum-frequency-chart/)
- [Kick Drum Frequencies](https://www.izotope.com/en/learn/kick-drum-mixing.html)
- [BPM Detection Algorithms](https://github.com/JMPerez/beats-audio-api)

---

🎵 **¡Ahora el logo reacciona como un verdadero VJ de música urbana!** 🔥
