/**
 * Módulo de Letras Sincronizadas
 * Muestra letras sobre el cover con timestamps
 */

// Detectar dispositivo iOS
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Configuración de sincronización con delay adaptativo por dispositivo
const LYRICS_CONFIG = {
    // iPhone/iPad necesitan más delay por buffer más agresivo de Safari
    STREAM_DELAY: isIOS ? 4.5 : 1.5,
    UPDATE_INTERVAL: 100 // Intervalo de actualización en milisegundos
};

// Log solo en desarrollo local
if (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')) {
    console.log(`🎵 LYRICS CONFIG: Delay adaptativo activado`);
    console.log(`📱 Dispositivo: ${isIOS ? 'iOS (iPhone/iPad)' : 'Desktop/Android'}`);
    console.log(`⏱️ Stream delay: ${LYRICS_CONFIG.STREAM_DELAY}s`);
}

class LyricsManager {
    constructor() {
        this.lyrics = [];
        this.currentIndex = -1;
        this.lyricsOverlay = document.getElementById('lyricsOverlay');
        this.lyricsPrevious = document.getElementById('lyricsPrevious');
        this.lyricsCurrent = document.getElementById('lyricsCurrent');
        this.audioElement = null;
        this.isActive = false;
        this.timeOffset = 0; // Offset inicial de la canción (tiempo transcurrido al cargar)
        this.songStartTimestamp = null; // Timestamp cuando empezó a contar
        this.useVirtualTime = false; // Si usa tiempo virtual basado en Azura
        this.updateInterval = null; // Intervalo para actualizar letras
    }

    /**
     * Inicializa el gestor de letras con el elemento de audio
     * @param {HTMLAudioElement} audioElement 
     */
    init(audioElement) {
        this.audioElement = audioElement;
        
        // Listener para actualizar letras en tiempo real (cuando no usa tiempo virtual)
        this.audioElement.addEventListener('timeupdate', () => {
            if (this.isActive && this.lyrics.length > 0 && !this.useVirtualTime) {
                this.updateLyrics();
            }
        });

        console.log('LyricsManager initialized');
    }

    /**
     * Carga letras desde un array con formato: [{time: segundos, text: "letra"}]
     * @param {Array} lyricsData - Array de objetos con time y text
     * @param {Number} startOffset - Tiempo inicial transcurrido en segundos (opcional)
     */
    loadLyrics(lyricsData, startOffset = 0) {
        // Ordenar letras por tiempo (crear nueva copia para no mutar el original)
        this.lyrics = [...lyricsData].sort((a, b) => a.time - b.time);
        this.currentIndex = -1;
        this.timeOffset = startOffset;
        this.songStartTimestamp = Date.now();
        this.useVirtualTime = startOffset > 0; // Usar tiempo virtual si hay offset
        
        if (this.lyrics.length > 0) {
            this.show();
            
            // Si usa tiempo virtual, iniciar intervalo de actualización
            if (this.useVirtualTime) {
                this.startVirtualTimeUpdate();
            }
            
            console.log(`Loaded ${this.lyrics.length} lyrics lines (offset: ${startOffset.toFixed(2)}s)`);
        } else {
            this.hide();
        }
    }

    /**
     * Inicia el intervalo de actualización con tiempo virtual
     */
    startVirtualTimeUpdate() {
        // Limpiar intervalo previo si existe
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Actualizar usando el intervalo configurado
        this.updateInterval = setInterval(() => {
            if (this.isActive && this.lyrics.length > 0 && this.useVirtualTime) {
                this.updateLyrics();
            }
        }, LYRICS_CONFIG.UPDATE_INTERVAL);
    }

    /**
     * Detiene el intervalo de actualización
     */
    stopVirtualTimeUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Calcula el tiempo actual de la canción
     * @returns {Number} Tiempo actual en segundos
     */
    getCurrentTime() {
        if (this.useVirtualTime) {
            // Tiempo virtual = offset inicial + tiempo transcurrido desde que se cargó
            const elapsed = (Date.now() - this.songStartTimestamp) / 1000;
            // Restar delay para compensar latencia del stream
            return Math.max(0, this.timeOffset + elapsed - LYRICS_CONFIG.STREAM_DELAY);
        } else {
            // Tiempo del elemento de audio
            return this.audioElement ? this.audioElement.currentTime : 0;
        }
    }

    /**
     * Carga letras desde formato LRC (texto con timestamps)
     * @param {String} lrcText - Texto en formato LRC
     */
    loadFromLRC(lrcText) {
        const lines = lrcText.split('\n');
        const lyrics = [];
        
        // Regex para detectar [mm:ss.xx] o [mm:ss]
        const timeRegex = /\[(\d{2}):(\d{2})\.?(\d{2,3})?\]/;
        
        lines.forEach(line => {
            const match = timeRegex.exec(line);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const centiseconds = match[3] ? parseInt(match[3]) : 0;
                
                const time = minutes * 60 + seconds + (centiseconds / (match[3]?.length === 3 ? 1000 : 100));
                const text = line.replace(timeRegex, '').trim();
                
                if (text) {
                    lyrics.push({ time, text });
                }
            }
        });
        
        this.loadLyrics(lyrics);
    }

    /**
     * Actualiza la visualización de letras según el tiempo actual
     */
    updateLyrics() {
        if (this.lyrics.length === 0) return;
        
        const currentTime = this.getCurrentTime();
        
        // Encontrar la línea actual
        let newIndex = -1;
        for (let i = this.lyrics.length - 1; i >= 0; i--) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
                break;
            }
        }
        
        // Si cambió la línea actual
        if (newIndex !== this.currentIndex && newIndex !== -1) {
            this.currentIndex = newIndex;
            this.displayLyric(newIndex);
        }
    }

    /**
     * Muestra la letra en la posición indicada
     * @param {Number} index - Índice de la letra a mostrar
     */
    displayLyric(index) {
        const current = this.lyrics[index];
        const previous = index > 0 ? this.lyrics[index - 1] : null;
        
        // Actualizar letra actual
        if (this.lyricsCurrent) {
            // Remover clase active para re-activar animación
            this.lyricsCurrent.classList.remove('active');
            
            // Pequeño delay para que la animación se re-ejecute
            setTimeout(() => {
                this.lyricsCurrent.textContent = current.text;
                this.lyricsCurrent.classList.add('active');
            }, 50);
        }
        
        // Actualizar letra anterior
        if (this.lyricsPrevious) {
            if (previous) {
                this.lyricsPrevious.textContent = previous.text;
                this.lyricsPrevious.style.opacity = '1';
            } else {
                this.lyricsPrevious.textContent = '';
                this.lyricsPrevious.style.opacity = '0';
            }
        }
        
        console.log(`Lyric displayed: "${current.text}" at ${current.time}s`);
    }

    /**
     * Muestra el overlay de letras
     */
    show() {
        if (this.lyricsOverlay) {
            this.lyricsOverlay.style.display = 'flex';
            this.isActive = true;
        }
    }

    /**
     * Oculta el overlay de letras
     */
    hide() {
        if (this.lyricsOverlay) {
            this.lyricsOverlay.style.display = 'none';
            this.isActive = false;
        }
    }

    /**
     * Limpia las letras actuales
     */
    clear() {
        this.lyrics = [];
        this.currentIndex = -1;
        this.timeOffset = 0;
        this.songStartTimestamp = null;
        this.useVirtualTime = false;
        this.stopVirtualTimeUpdate();
        
        if (this.lyricsCurrent) this.lyricsCurrent.textContent = '';
        if (this.lyricsPrevious) this.lyricsPrevious.textContent = '';
        this.hide();
    }

    /**
     * Obtiene letras de prueba para demostración
     */
    static getDemoLyrics() {
        return [
            { time: 0.5, text: "🎵 Esta es la primera línea" },
            { time: 3.5, text: "La segunda línea aparece aquí" },
            { time: 6.5, text: "Y seguimos con la tercera" },
            { time: 9.5, text: "Las letras se sincronizan" },
            { time: 12.5, text: "Con el audio en tiempo real" },
            { time: 15.5, text: "Aparecen y desaparecen" },
            { time: 18.5, text: "De forma automática 🎶" },
            { time: 21.5, text: "Siguiendo los timestamps" },
            { time: 24.5, text: "¡Así funciona el sistema!" },
            { time: 27.5, text: "Fin de la demostración ✨" }
        ];
    }
}

// Exportar para uso global
window.LyricsManager = LyricsManager;
