/**
 * Aplicación de reproductor de radio La Urban
 * Maneja la reproducción de audio, visualización de información de canciones y streaming en vivo
 */

(function () {
    'use strict';

    // Constantes de configuración
    const CONFIG = {
        STREAM_URL: 'https://play.laurban.cl/',
        API_URL: 'https://azura.laurban.cl/api/nowplaying/laurban',
        KICK_API_URL: 'https://kick.com/api/v2/channels/laurban/livestream',
        KICK_EMBED_URL: 'https://player.kick.com/laurban?muted=true&autoplay=true',
        REQUEST_IFRAME_URL: 'https://azura.laurban.cl/public/laurban/embed-requests?theme=dark',
        CHAT_IFRAME_URL: 'https://www3.cbox.ws/box/?boxid=3539409&boxtag=Q2vpWH',
        WHATSAPP_URL: 'whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz',
        DEFAULT_TITLE: 'La Urban · Emisora Online',
        DEFAULT_COVER: 'https://laurban.cl/img/default.jpg',
        UPDATE_INTERVAL: 30000,
        INITIAL_DELAY: 1000,
        RETRY_DELAY: 2000,
        THEME_LIGHT_START: 6,
        THEME_LIGHT_END: 18
    };

    // Estado de la aplicación
    const state = {
        userPaused: false,
        isKickLive: false,
        showingKickVideo: false,
        iframeLoaded: false,
        iframe2Loaded: false
    };

    // Referencias a elementos DOM (se inicializarán en DOMContentLoaded)
    const elements = {};


    /**
     * Establece el tema visual basado en la hora del día
     */
    function setThemeByTime() {
        const hour = new Date().getHours();
        const isDaytime = hour >= CONFIG.THEME_LIGHT_START && hour < CONFIG.THEME_LIGHT_END;
        
        document.body.style.background = isDaytime
            ? 'linear-gradient(135deg, #f89200, #facc22)'
            : 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
    }

    /**
     * Habilita el canvas de chat y maneja sus eventos
     */
    function enableChatCanvas() {
        elements.dynamicCanvas.addEventListener('click', (event) => {
            event.preventDefault();
            
            if (!state.iframe2Loaded) {
                elements.button2Text.textContent = 'Cargando...';
                elements.dynamicCanvas.disabled = true;
                
                elements.newRequestFrame.addEventListener('load', () => {
                    elements.chatCanvas.classList.add('open');
                    elements.button2Text.textContent = 'Chat en vivo';
                    elements.dynamicCanvas.disabled = false;
                    state.iframe2Loaded = true;
                }, { once: true });
                
                elements.newRequestFrame.src = CONFIG.CHAT_IFRAME_URL;
            } else {
                elements.chatCanvas.classList.toggle('open');
            }
        });
    }

    /**
     * Actualiza los metadatos de la sesión de medios del navegador
     * @param {Object} data - Datos de la canción actual de la API
     * @param {boolean} coverUpdate - Si se debe actualizar la carátula
     */
    function updateMediaSession(data, coverUpdate = false) {
        if (!('mediaSession' in navigator)) {
            return;
        }

        const albumArt = data?.now_playing?.song?.art || CONFIG.DEFAULT_COVER;
        
        if (coverUpdate && elements.cover) {
            elements.cover.src = albumArt;
        }

        const artwork = [96, 128, 192, 256, 384, 512].map(size => ({
            src: albumArt,
            sizes: `${size}x${size}`,
            type: 'image/jpeg'
        }));

        navigator.mediaSession.metadata = new MediaMetadata({
            title: `La Urban: ${data?.now_playing?.song?.title || 'Música'}`,
            artist: data?.now_playing?.song?.artist || 'Artista desconocido',
            album: data?.now_playing?.song?.album || '',
            artwork
        });

        navigator.mediaSession.setActionHandler('play', playAudio);
        navigator.mediaSession.setActionHandler('pause', pauseAudio);
        navigator.mediaSession.setActionHandler('stop', pauseAudio);
    }

    /**
     * Reproduce el audio de la emisora
     */
    async function playAudio() {
        try {
            elements.audio.src = CONFIG.STREAM_URL;
            await elements.audio.play();
            state.userPaused = false;
        } catch (error) {
            console.error('Error al reproducir el audio:', error);
            if (!state.userPaused) {
                setTimeout(playAudio, CONFIG.RETRY_DELAY);
            }
        }
    }

    /**
     * Pausa el audio de la emisora
     */
    function pauseAudio() {
        state.userPaused = true;
        elements.audio.pause();
    }

    /**
     * Obtiene los datos actuales de la radio desde la API
     * @returns {Promise<Object|null>} Datos de la radio o null en caso de error
     */
    async function getRadioData() {
        try {
            const response = await fetch(CONFIG.API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error al obtener la información de la canción:', error);
            return null;
        }
    }

    /**
     * Verifica si hay un stream en vivo en Kick
     * @returns {Promise<boolean>} True si hay un stream en vivo
     */
    async function getKickLiveInfo() {
        try {
            const response = await fetch(CONFIG.KICK_API_URL);
            if (!response.ok) {
                return false;
            }
            const data = await response.json();
            return data?.data !== null && data?.data !== undefined;
        } catch (error) {
            console.error('Error al obtener la info de kick:', error);
            return false;
        }
    }

    /**
     * Muestra el video de Kick en lugar de la carátula
     */
    function showKickVideo() {
        state.showingKickVideo = true;
        const playerContainer = document.querySelector('.player-container');
        
        if (playerContainer) {
            playerContainer.style.maxWidth = '800px';
        }
        
        if (elements.logo) {
            elements.logo.style.maxWidth = '400px';
        }

        const coverContainer = document.querySelector('.cover-container');
        if (coverContainer) {
            coverContainer.innerHTML = `
                <div id="kickVideoContainer" style="position: relative; padding-top: 56.25%;">
                    <iframe 
                        src="${CONFIG.KICK_EMBED_URL}" 
                        frameborder="0" 
                        allowfullscreen
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                        scrolling="no"
                        title="Kick Live Stream">
                    </iframe>
                </div>
            `;
        }
    }

    /**
     * Oculta el video de Kick y restaura la carátula
     */
    function hideKickVideo() {
        if (!state.showingKickVideo) {
            return;
        }
        
        const coverContainer = document.querySelector('.cover-container');
        if (coverContainer) {
            coverContainer.innerHTML = `<img id="cover" src="${CONFIG.DEFAULT_COVER}" alt="Carátula del Álbum" class="cover">`;
            elements.cover = document.getElementById('cover');
        }
        
        const playerContainer = document.querySelector('.player-container');
        if (playerContainer) {
            playerContainer.style.maxWidth = '400px';
        }
        
        if (elements.logo) {
            elements.logo.style.maxWidth = '100%';
        }
        
        state.showingKickVideo = false;
    }

    /**
     * Parsea la información del artista y maneja los featuring
     * @param {string} artist - String del artista(s)
     * @param {string} songTitle - Título de la canción
     * @returns {Object} Objeto con artista principal y título formateado
     */
    function parseArtistInfo(artist, songTitle) {
        const [mainArtist, ...extraArtists] = artist.split(';').map(part => part.trim());
        const extraArtistsText = extraArtists.join(', ');
        
        const formattedTitle = extraArtistsText && !songTitle.includes(extraArtistsText)
            ? `${songTitle} (feat. ${extraArtistsText})`
            : songTitle;
        
        return { mainArtist, formattedTitle };
    }

    /**
     * Actualiza la UI con información de emisión en vivo
     * @param {Object} radioData - Datos de la radio
     */
    function updateLiveInfo(radioData) {
        const livename = radioData.live.streamer_name 
            ? `En vivo: ${radioData.live.streamer_name}` 
            : '¡En Vivo!';
        const liveart = radioData.live.art || CONFIG.DEFAULT_COVER;
        const livetitle = `La Urban · ${livename}`;
        
        if (elements.song) {
            elements.song.textContent = livename;
        }
        
        document.title = livetitle;
        
        if (!state.showingKickVideo && elements.cover) {
            elements.cover.src = liveart;
        }
    }

    /**
     * Actualiza la UI con información de la canción actual
     * @param {Object} radioData - Datos de la radio
     */
    function updateSongInfoUI(radioData) {
        if (!radioData?.now_playing?.song) {
            if (!state.showingKickVideo && elements.cover) {
                elements.cover.src = CONFIG.DEFAULT_COVER;
            }
            if (elements.song) {
                elements.song.textContent = CONFIG.DEFAULT_TITLE;
            }
            document.title = CONFIG.DEFAULT_TITLE;
            return;
        }

        const { artist, title: songTitle, art } = radioData.now_playing.song;
        const { mainArtist, formattedTitle } = parseArtistInfo(artist, songTitle);
        const songText = `Escuchas: ${mainArtist} - ${formattedTitle}`;

        if (!state.showingKickVideo && elements.cover) {
            elements.cover.src = art || CONFIG.DEFAULT_COVER;
            elements.audio.setAttribute('poster', elements.cover.src);
        }
        
        if (elements.song) {
            elements.song.textContent = songText;
        }
        
        document.title = `La Urban · Reproduciendo: ${mainArtist} - ${formattedTitle}`;
        elements.audio.setAttribute('title', songText);
    }

    /**
     * Configura el botón dinámico según el estado de emisión en vivo
     * @param {boolean} isLive - Si hay emisión en vivo
     */
    function configureDynamicButton(isLive) {
        if (state.isKickLive) {
            return;
        }

        elements.dynamicButton.href = isLive ? CONFIG.WHATSAPP_URL : '#';
        elements.buttonIcon.className = isLive ? 'fab fa-whatsapp' : 'fas fa-music';
        elements.buttonText.textContent = isLive ? 'Escríbenos' : 'Pedir canción';

        if (isLive) {
            elements.dynamicButton.onclick = null;
        } else {
            elements.dynamicButton.onclick = (event) => {
                event.preventDefault();
                
                if (!state.iframeLoaded) {
                    elements.buttonText.textContent = 'Cargando...';
                    elements.dynamicButton.disabled = true;
                    
                    elements.requestIframe.addEventListener('load', () => {
                        elements.musicRequestCanvas.classList.add('open');
                        elements.buttonText.textContent = 'Pedir canción';
                        elements.dynamicButton.disabled = false;
                        state.iframeLoaded = true;
                    }, { once: true });
                    
                    elements.requestIframe.src = CONFIG.REQUEST_IFRAME_URL;
                } else {
                    elements.musicRequestCanvas.classList.toggle('open');
                }
            };
        }
    }

    /**
     * Actualiza toda la información de la canción y estado de la emisora
     */
    async function updateSongInfo() {
        try {
            const [radioData, kickLive] = await Promise.all([
                getRadioData(),
                getKickLiveInfo()
            ]);
            
            if (!radioData) {
                return;
            }

            state.isKickLive = kickLive;
            const isLive = radioData.live?.is_live || false;

            if (isLive) {
                updateLiveInfo(radioData);
            } else {
                updateSongInfoUI(radioData);
            }

            // Manejo del video de Kick
            if (state.isKickLive && !state.showingKickVideo) {
                showKickVideo();
            } else if (!state.isKickLive && state.showingKickVideo) {
                hideKickVideo();
            }

            updateMediaSession(radioData, !state.showingKickVideo);
            configureDynamicButton(isLive);
            
        } catch (error) {
            console.error('Error en updateSongInfo:', error);
        }
    }

    /**
     * Maneja el clic fuera de los canvas para cerrarlos
     * @param {Event} event - Evento de click
     */
    function handleOutsideClick(event) {
        if (!elements.musicRequestCanvas.contains(event.target) && 
            !elements.dynamicButton.contains(event.target)) {
            elements.musicRequestCanvas.classList.remove('open');
        }
        
        if (!elements.chatCanvas.contains(event.target) && 
            !elements.dynamicCanvas.contains(event.target)) {
            elements.chatCanvas.classList.remove('open');
        }
    }

    /**
     * Inicializa la reproducción automática
     */
    async function initializeAutoplay() {
        setTimeout(async () => {
            if (!elements.audio.paused) {
                elements.overlay.style.display = 'none';
                elements.logo.classList.add('active');
                return;
            }
            
            if (elements.audio.paused && !state.userPaused) {
                await playAudio();
                elements.overlay.style.display = 'none';
                elements.logo.classList.add('active');
            }
        }, CONFIG.INITIAL_DELAY);
    }

    /**
     * Inicializa todos los elementos del DOM
     */
    function initializeElements() {
        elements.audio = document.getElementById('audio');
        elements.playButton = document.getElementById('playButton');
        elements.overlay = document.getElementById('overlay');
        elements.logo = document.getElementById('logo');
        elements.dynamicButton = document.getElementById('dynamicButton');
        elements.dynamicCanvas = document.getElementById('dynamicCanvas');
        elements.buttonIcon = document.getElementById('buttonIcon');
        elements.buttonText = document.getElementById('buttonText');
        elements.button2Icon = document.getElementById('button2Icon');
        elements.button2Text = document.getElementById('button2Text');
        elements.musicRequestCanvas = document.getElementById('musicRequestCanvas');
        elements.chatCanvas = document.getElementById('chatCanvas');
        elements.requestIframe = document.getElementById('requestIframe');
        elements.newRequestFrame = document.getElementById('newRequestFrame');
        elements.closeButton = document.getElementById('closeButton');
        elements.close2Button = document.getElementById('close2Button');
        elements.song = document.getElementById('song');
        elements.cover = document.getElementById('cover');
    }

    /**
     * Configura todos los event listeners
     */
    function setupEventListeners() {
        // Botón de reproducción
        elements.playButton.addEventListener('click', async () => {
            await playAudio();
            elements.overlay.style.display = 'none';
            elements.logo.classList.add('active');
        });

        // Audio ended
        elements.audio.addEventListener('ended', () => {
            if (!state.userPaused) {
                playAudio();
            }
        });

        // Botones de cierre
        elements.closeButton.addEventListener('click', () => {
            elements.musicRequestCanvas.classList.remove('open');
        });
        
        elements.close2Button.addEventListener('click', () => {
            elements.chatCanvas.classList.remove('open');
        });

        // Clics fuera de los canvas
        document.addEventListener('click', handleOutsideClick);
    }

    /**
     * Inicializa la aplicación
     */
    function init() {
        initializeElements();
        setupEventListeners();
        setThemeByTime();
        enableChatCanvas();
        updateSongInfo();
        setInterval(updateSongInfo, CONFIG.UPDATE_INTERVAL);
        initializeAutoplay();
    }

    // Iniciar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);

})();

