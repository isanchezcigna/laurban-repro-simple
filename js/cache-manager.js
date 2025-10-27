/**
 * Gestor de caché simplificado para La Urban
 */

// Inicializar logger o usar fallback
const logger = globalThis.logger || {
    dev: console.log.bind(console),
    info: console.log.bind(console),
    success: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    critical: console.error.bind(console)
};

class CacheManager {
    laurbanData = null;
    lastCheck = 0;
    currentSongId = null;
    currentLiveState = false;
    updateInterval = 15000; // 15 segundos solo para datos principales

    /**
     * Verifica si es necesario actualizar los datos principales
     */
    needsUpdate() {
        const now = Date.now();
        return !this.laurbanData || (now - this.lastCheck) >= this.updateInterval;
    }

    /**
     * Verifica si los datos han cambiado significativamente
     */
    hasChanged(newData) {
        if (!this.laurbanData || !newData) return true;

        let songChanged = false;
        let liveStateChanged = false;

        // Verificar cambio de canción
        if (this.laurbanData.now_playing?.id !== newData.now_playing?.id) {
            songChanged = true;
            logger.info('🎵 Detectado cambio de canción');
        }

        // Verificar cambio en estado de live
        if (this.laurbanData.live?.is_live !== newData.live?.is_live) {
            liveStateChanged = true;
            logger.info('🎥 Detectado cambio en estado de live');
        }

        return songChanged || liveStateChanged;
    }

    /**
     * Actualiza los datos en caché
     */
    update(newData) {
        this.laurbanData = newData;
        this.lastCheck = Date.now();
        this.currentSongId = newData.now_playing?.id;
        this.currentLiveState = newData.live?.is_live || false;
    }

    /**
     * Obtiene los datos actuales del caché
     */
    get() {
        return this.laurbanData;
    }
}

// Exportar la clase
globalThis.CacheManager = CacheManager;