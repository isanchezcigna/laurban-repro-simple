/**
 * Módulo para mostrar información de la canción actual y sus letras
 * NOTA: Este módulo requiere una API key válida de Musixmatch
 */

(function () {
    'use strict';

    // Inicializar logger o usar fallback
    const logger = window.logger || {
        dev: console.log.bind(console),
        info: console.log.bind(console),
        success: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        critical: console.error.bind(console)
    };

    // Configuración de la aplicación
    const CONFIG = {
        AZURACAST_API_URL: 'https://azura.laurban.cl/api/nowplaying/laurban',
        MUSIXMATCH_API_KEY: '', // TODO: Agregar API key válida o usar variable de entorno
        MUSIXMATCH_API_URL: 'https://api.musixmatch.com/ws/1.1/matcher.lyrics.get',
        UPDATE_INTERVAL: 30000 // 30 segundos
    };

    // Referencias a elementos DOM
    let elements = null;

    /**
     * Inicializa las referencias a los elementos del DOM
     */
    function initializeElements() {
        elements = {
            audio: document.getElementById('audio'),
            currentSongDiv: document.getElementById('current-song'),
            lyricsDiv: document.getElementById('lyrics')
        };

        // Validar que todos los elementos existen
        if (!elements.audio || !elements.currentSongDiv || !elements.lyricsDiv) {
            logger.error('Error: No se encontraron todos los elementos necesarios en el DOM');
            return false;
        }
        
        return true;
    }

    /**
     * Obtiene la información de la canción actual desde AzuraCast
     * @returns {Promise<Object|null>} Información de la canción o null en caso de error
     */
    async function fetchCurrentSong() {
        try {
            const response = await fetch(CONFIG.AZURACAST_API_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data?.now_playing?.song) {
                throw new Error('Formato de respuesta inválido');
            }
            
            return data.now_playing.song;
        } catch (error) {
            logger.error('Error al obtener la canción actual:', error);
            return null;
        }
    }

    /**
     * Obtiene las letras de una canción desde Musixmatch
     * @param {string} trackName - Nombre de la canción
     * @param {string} artistName - Nombre del artista
     * @returns {Promise<string|null>} Letras de la canción o null en caso de error
     */
    async function fetchLyrics(trackName, artistName) {
        // Validar API key
        if (!CONFIG.MUSIXMATCH_API_KEY) {
            logger.warn('API key de Musixmatch no configurada');
            return 'Para ver las letras, configure una API key válida de Musixmatch';
        }

        try {
            const params = new URLSearchParams({
                q_track: trackName,
                q_artist: artistName,
                apikey: CONFIG.MUSIXMATCH_API_KEY
            });

            const response = await fetch(`${CONFIG.MUSIXMATCH_API_URL}?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data?.message?.body?.lyrics?.lyrics_body) {
                return data.message.body.lyrics.lyrics_body;
            }
            
            return 'Letras no disponibles';
        } catch (error) {
            logger.error('Error al obtener las letras:', error);
            return 'No se pudieron cargar las letras';
        }
    }

    /**
     * Actualiza la información de la canción en la UI
     * @param {Object} song - Objeto con información de la canción
     */
    function updateSongDisplay(song) {
        if (!elements?.currentSongDiv) {
            return;
        }

        const songText = `${song.title} - ${song.artist}`;
        elements.currentSongDiv.textContent = songText;
    }

    /**
     * Actualiza las letras en la UI
     * @param {string} lyrics - Letras de la canción
     */
    function updateLyricsDisplay(lyrics) {
        if (!elements?.lyricsDiv) {
            return;
        }

        elements.lyricsDiv.textContent = lyrics || 'Letras no disponibles';
    }

    /**
     * Actualiza la información de la canción y sus letras
     */
    async function updateSongInfo() {
        try {
            const song = await fetchCurrentSong();
            
            if (!song) {
                updateSongDisplay({ title: 'Información no disponible', artist: '' });
                updateLyricsDisplay('No se pudo cargar la información');
                return;
            }

            updateSongDisplay(song);
            
            const lyrics = await fetchLyrics(song.title, song.artist);
            updateLyricsDisplay(lyrics);
        } catch (error) {
            logger.error('Error al actualizar la información:', error);
        }
    }

    /**
     * Configura los event listeners
     */
    function setupEventListeners() {
        if (!elements?.audio) {
            return;
        }

        // Actualizar cuando el audio empiece a reproducirse
        elements.audio.addEventListener('play', updateSongInfo);
    }

    /**
     * Inicializa la aplicación
     */
    function init() {
        if (!initializeElements()) {
            return;
        }

        setupEventListeners();
        updateSongInfo(); // Actualización inicial
        
        // Actualizar periódicamente
        setInterval(updateSongInfo, CONFIG.UPDATE_INTERVAL);
    }

    // Iniciar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);

})();
