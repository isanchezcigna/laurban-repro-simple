/**
 * Aplicación de reproductor de radio La Urban
 * Maneja la reproducción de audio, visualización de información de canciones y streaming en vivo
 */

(function () {
    'use strict';

    // Suprimir TODOS los errores de extensiones del navegador de forma más agresiva
    const originalError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        // Filtrar errores conocidos de extensiones
        if (message.includes('Extension context invalidated') ||
            message.includes('message port closed') ||
            message.includes('Receiving end does not exist') ||
            message.includes('chrome.runtime')) {
            return; // Silenciar completamente
        }
        originalError.apply(console, args);
    };

    // Interceptar chrome.runtime completamente
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
            // Envolver sendMessage
            const originalSendMessage = chrome.runtime.sendMessage;
            if (originalSendMessage) {
                chrome.runtime.sendMessage = function(...args) {
                    try {
                        const callback = args[args.length - 1];
                        if (typeof callback === 'function') {
                            args[args.length - 1] = function(response) {
                                if (chrome.runtime.lastError) {
                                    // Silenciar error
                                    return;
                                }
                                callback(response);
                            };
                        }
                        return originalSendMessage.apply(this, args);
                    } catch (e) {
                        return undefined;
                    }
                };
            }

            // Envolver connect
            const originalConnect = chrome.runtime.connect;
            if (originalConnect) {
                chrome.runtime.connect = function(...args) {
                    try {
                        return originalConnect.apply(this, args);
                    } catch (e) {
                        return {
                            postMessage: () => {},
                            disconnect: () => {},
                            onMessage: { addListener: () => {} }
                        };
                    }
                };
            }
        } catch (e) {
            // Silenciar cualquier error al interceptar
        }
    }

    // Event listener para errores globales
    window.addEventListener('error', function(e) {
        if (e.message && (
            e.message.includes('Extension context invalidated') ||
            e.message.includes('message port closed') ||
            e.message.includes('chrome.runtime')
        )) {
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
    }, true);

    // Constantes de configuración
    const CONFIG = {
        STREAM_URL: 'https://stream.laurban.cl:8000/media',
        API_URL: 'https://azura.laurban.cl/api/nowplaying/laurban',
        KICK_API_URL: 'https://kick.com/api/v2/channels/laurban/livestream',
        KICK_EMBED_URL: 'https://player.kick.com/laurban?muted=true&autoplay=true',
        REQUEST_IFRAME_URL: 'https://azura.laurban.cl/public/laurban/embed-requests?theme=dark',
        CHAT_IFRAME_URL: 'https://www3.cbox.ws/box/?boxid=3539409&boxtag=Q2vpWH',
        WHATSAPP_URL: 'whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz',
        DEFAULT_TITLE: 'La Urban · Emisora Online',
        DEFAULT_COVER: 'https://laurban.cl/img/default.jpg',
        UPDATE_INTERVAL: 10000, // Actualización cada 10 segundos para cambios rápidos
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
        iframe2Loaded: false,
        audioContext: null,
        analyser: null,
        audioSource: null,
        isVisualizerActive: false,
        retryCount: 0,
        maxRetries: 3,
        currentCoverUrl: '',
        lastSongId: null,
        isFirstPlay: true, // Bandera para detectar primera reproducción
        volumeFadeInterval: null, // Intervalo para el fade de volumen
        volumeDisplayTimeout: null // Timeout para ocultar el porcentaje de volumen
    };

    // Referencias a elementos DOM (se inicializarán en DOMContentLoaded)
    const elements = {};

    /**
     * Inicializa el contexto de audio y el analizador para visualización
     */
    function initializeAudioVisualizer() {
        if (state.audioContext) {
            return; // Ya está inicializado
        }

        try {
            // Crear contexto de audio
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            state.audioContext = new AudioContext();
            
            // Crear analizador con mejor resolución para detectar kick
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = 2048; // Mayor resolución para mejor detección de frecuencias bajas
            state.analyser.smoothingTimeConstant = 0.6; // Menos suavizado para captar transitorios (kicks)
            state.analyser.minDecibels = -90;
            state.analyser.maxDecibels = -10;
            
            // Conectar el elemento de audio al analizador
            if (!state.audioSource) {
                state.audioSource = state.audioContext.createMediaElementSource(elements.audio);
                state.audioSource.connect(state.analyser);
                state.analyser.connect(state.audioContext.destination);
            }
            
            state.isVisualizerActive = true;
            state.kickDetection = {
                threshold: 0.7,
                lastKickTime: 0,
                minTimeBetweenKicks: 150, // ms - evita falsas detecciones
                history: [],
                maxHistory: 10
            };
            
            startLogoVisualization();
            startBackgroundVisualization();
            
            console.log('✅ Visualizador de audio inicializado correctamente');
            console.log('🎵 Detección de kick/bass optimizada para música urbana');
            
        } catch (error) {
            console.warn('⚠️ No se pudo inicializar el visualizador de audio (probablemente CORS):', error.message);
            console.log('ℹ️ El audio seguirá funcionando normalmente sin efectos visuales');
            
            // Aplicar animación CSS alternativa si el visualizador falla
            if (elements.logo) {
                elements.logo.style.animation = 'pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite';
            }
        }
    }

    /**
     * Anima el logo basándose en la frecuencia del audio con detección de kick mejorada
     */
    function startLogoVisualization() {
        if (!state.isVisualizerActive || !state.analyser) {
            return;
        }

        const bufferLength = state.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let kickScale = 1.0;
        let kickDecay = 0;

        function animate() {
            if (!state.isVisualizerActive || elements.audio.paused) {
                requestAnimationFrame(animate);
                return;
            }

            state.analyser.getByteFrequencyData(dataArray);
            
            // Análisis de frecuencias optimizado para música urbana
            // Sub-bass (20-60 Hz) - Índices 0-5 - Donde está el kick/bombo
            const subBass = dataArray.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
            
            // Bass (60-250 Hz) - Índices 6-20 - 808s, bajo
            const bass = dataArray.slice(6, 21).reduce((a, b) => a + b, 0) / 15;
            
            // Low-mids (250-500 Hz) - Índices 21-40 - Snares, cuerpo de instrumentos
            const lowMid = dataArray.slice(21, 41).reduce((a, b) => a + b, 0) / 20;
            
            // Mids (500-2000 Hz) - Índices 41-160 - Voces, melodías
            const mid = dataArray.slice(41, 161).reduce((a, b) => a + b, 0) / 120;
            
            // High-mids (2000-4000 Hz) - Índices 161-320 - Presencia vocal
            const highMid = dataArray.slice(161, 321).reduce((a, b) => a + b, 0) / 160;
            
            // Highs (4000+ Hz) - Índices 321+ - Hi-hats, platillos, brillo
            const highs = dataArray.slice(321, 480).reduce((a, b) => a + b, 0) / 159;
            
            // Normalizar valores (0-1)
            const subBassNorm = subBass / 255;
            const bassNorm = bass / 255;
            const lowMidNorm = lowMid / 255;
            const midNorm = mid / 255;
            const highMidNorm = highMid / 255;
            const highsNorm = highs / 255;
            
            // Detección inteligente de kick usando sub-bass y cambios bruscos
            const currentTime = Date.now();
            const kickEnergy = subBassNorm * 0.7 + bassNorm * 0.3;
            const timeSinceLastKick = currentTime - state.kickDetection.lastKickTime;
            
            // Detectar kick: energía alta en sub-bass + tiempo mínimo entre kicks
            if (kickEnergy > state.kickDetection.threshold && 
                timeSinceLastKick > state.kickDetection.minTimeBetweenKicks) {
                
                // ¡KICK DETECTADO! 🥁
                kickScale = 1.25; // Escala dramática
                kickDecay = 1.0;
                state.kickDetection.lastKickTime = currentTime;
                
                // Guardar en historial para análisis de BPM
                state.kickDetection.history.push(currentTime);
                if (state.kickDetection.history.length > state.kickDetection.maxHistory) {
                    state.kickDetection.history.shift();
                }
            }
            
            // Decay del kick (efecto de rebote natural)
            if (kickDecay > 0) {
                kickDecay *= 0.85; // Decay rápido pero suave
                kickScale = 1.0 + (0.25 * kickDecay);
            } else {
                kickScale = 1.0;
            }
            
            // Calcular BPM estimado basado en el historial de kicks
            let bpmMultiplier = 1.0;
            if (state.kickDetection.history.length >= 4) {
                const intervals = [];
                for (let i = 1; i < state.kickDetection.history.length; i++) {
                    intervals.push(state.kickDetection.history[i] - state.kickDetection.history[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const estimatedBPM = 60000 / avgInterval;
                
                // Ajustar multiplicador según BPM (música urbana típicamente 80-160 BPM)
                if (estimatedBPM >= 80 && estimatedBPM <= 160) {
                    bpmMultiplier = 1.0 + ((estimatedBPM - 120) / 400); // Sutil ajuste
                }
            }
            
            // Aplicar efectos al logo con énfasis en kick
            applyLogoEffects(kickScale, subBassNorm, bassNorm, midNorm, highMidNorm, highsNorm, bpmMultiplier);
            
            requestAnimationFrame(animate);
        }

        animate();
    }

    /**
     * Aplica efectos visuales al logo basados en las frecuencias de audio con énfasis en kick
     * @param {number} kickScale - Escala del kick detectado (1.0-1.25)
     * @param {number} subBass - Intensidad sub-bass (0-1)
     * @param {number} bass - Intensidad bass (0-1)
     * @param {number} mid - Intensidad mids (0-1)
     * @param {number} highMid - Intensidad high-mids (0-1)
     * @param {number} highs - Intensidad highs (0-1)
     * @param {number} bpmMultiplier - Multiplicador basado en BPM (0.8-1.2)
     */
    function applyLogoEffects(kickScale, subBass, bass, mid, highMid, highs, bpmMultiplier) {
        if (!elements.logo) {
            return;
        }

        // KICK domina la escala - 90% kick, 10% mids
        const kickContribution = (kickScale - 1) * 0.9;
        const midContribution = mid * 0.01; // Mids muy sutiles en escala
        const scale = (1.0 + kickContribution + midContribution) * bpmMultiplier;
        
        // Rotación: Mids suaves (casi la mitad del efecto anterior)
        const rotation = ((mid + highMid) / 2 - 0.5) * 4 * bpmMultiplier; // Reducido de 8 a 4
        
        // Brillo: Kick domina, mids aportan sutilmente
        const kickBrightness = (kickScale - 1) * 0.6; // 60% del kick
        const midBrightness = (mid + highMid) / 2 * 0.1; // Solo 10% de mids
        const brightness = 1 + kickBrightness + midBrightness;
        
        // Saturación: Kick principalmente, mids como acento
        const kickSaturation = (kickScale - 1) * 0.4;
        const midSaturation = ((mid + highMid) / 2) * 0.15; // Reducido de 0.4 a 0.15
        const saturation = 1 + kickSaturation + midSaturation;
        
        // Sombra: Kick DOMINA completamente, mids casi no afectan
        const kickShadow = (kickScale - 1) * 65; // 65px máximo en kick
        const bassShadow = bass * 15; // Bass base sutil
        const midShadow = mid * 5; // Mids muy sutiles (reducido de 10 a 5)
        const shadowIntensity = 15 + bassShadow + midShadow + kickShadow;
        
        const kickOpacity = (kickScale - 1) * 0.55;
        const bassOpacity = bass * 0.25;
        const midOpacity = mid * 0.05; // Mids muy sutiles
        const shadowOpacity = 0.4 + bassOpacity + midOpacity + kickOpacity;
        const shadowColor = `rgba(252, 94, 22, ${shadowOpacity})`;
        
        // Movimiento vertical: SOLO el kick comanda el salto (golpe)
        let verticalMove = 0;
        if (kickScale > 1.1) {
            // El salto es proporcional al kick, mids NO afectan
            verticalMove = (kickScale - 1) * 25; // Aumentado de 20 a 25 para más impacto
        }
        
        // Aplicar transformaciones - KICK es el protagonista
        elements.logo.style.transform = `scale(${scale}) rotate(${rotation}deg) translateY(-${verticalMove}px)`;
        elements.logo.style.filter = `brightness(${brightness}) saturate(${saturation})`;
        elements.logo.style.filter += ` drop-shadow(0 0 ${shadowIntensity}px ${shadowColor})`;
        
        // Bonus: Efecto de "impacto" visual en kicks muy fuertes
        if (kickScale > 1.2) {
            // Pequeña distorsión en X para simular "golpe"
            const impact = (kickScale - 1.2) * 3;
            elements.logo.style.transform += ` scaleX(${1 + impact * 0.1})`;
        }
    }

    /**
     * Anima el background basándose en la frecuencia del audio
     */
    function startBackgroundVisualization() {
        if (!state.isVisualizerActive || !state.analyser) {
            return;
        }

        const bufferLength = state.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function animateBackground() {
            if (!state.isVisualizerActive) {
                return;
            }

            requestAnimationFrame(animateBackground);
            state.analyser.getByteFrequencyData(dataArray);

            // El background reacciona a frecuencias ALTAS (hi-hats, voces agudas, platillos)
            // Esto lo hace complementario al logo que reacciona al kick/bass
            
            // Highs: 4kHz+ (últimos 20% del espectro)
            const highStart = Math.floor(bufferLength * 0.8);
            let highSum = 0;
            for (let i = highStart; i < bufferLength; i++) {
                highSum += dataArray[i];
            }
            const highAvg = (highSum / (bufferLength - highStart)) / 255;

            // High-Mids: 2kHz-4kHz (voces, melodías)
            const highMidStart = Math.floor(bufferLength * 0.5);
            const highMidEnd = highStart;
            let highMidSum = 0;
            for (let i = highMidStart; i < highMidEnd; i++) {
                highMidSum += dataArray[i];
            }
            const highMidAvg = (highMidSum / (highMidEnd - highMidStart)) / 255;

            // Mids: 500Hz-2kHz
            const midStart = Math.floor(bufferLength * 0.15);
            const midEnd = highMidStart;
            let midSum = 0;
            for (let i = midStart; i < midEnd; i++) {
                midSum += dataArray[i];
            }
            const midAvg = (midSum / (midEnd - midStart)) / 255;

            applyBackgroundEffects(highAvg, highMidAvg, midAvg);
        }

        animateBackground();
    }

    /**
     * Aplica efectos visuales VISIBLES al background basados en frecuencias ALTAS
     * El background reacciona a highs/mids (complementario al logo que reacciona a kick/bass)
     * @param {number} highs - Intensidad de agudos (0-1) - hi-hats, platillos
     * @param {number} highMids - Intensidad de agudos-medios (0-1) - voces agudas
     * @param {number} mids - Intensidad de medios (0-1) - melodías
     */
    function applyBackgroundEffects(highs, highMids, mids) {
        if (!elements.backgroundOverlay) {
            return;
        }

        // Opacidad MUCHO MÁS visible - debe notarse claramente
        const opacity = 0.5 + (highs * 0.7) + (highMids * 0.3); // 0.5 a 1.5 (MUY VISIBLE!)
        
        // Hue shift MÁS DRAMÁTICO
        const hueShift = (highs * 60) - (mids * 20); // -20 a +60 grados
        
        // Saturación MÁS INTENSA
        const saturation = 1.2 + (highs * 1.2) + (highMids * 0.5); // 1.2 a 2.9
        
        // Brillo MÁS EVIDENTE
        const brightness = 1.1 + (highMids * 0.7) + (highs * 0.5); // 1.1 a 2.3
        
        // Scale más pronunciado
        const scale = 1 + (highs * 0.18) + (highMids * 0.09); // 1.0 a 1.27
        
        // Aplicar filtros - AHORA MUY VISIBLES
        elements.backgroundOverlay.style.opacity = Math.min(opacity, 1.0);
        elements.backgroundOverlay.style.filter = `brightness(${brightness}) saturate(${saturation}) hue-rotate(${hueShift}deg)`;
        elements.backgroundOverlay.style.transform = `scale(${scale})`;
        
        // Background texture con cambios MÁS EVIDENTES
        const bgHue = (highMids * 30) + (mids * 18) - (highs * 12); // -12 a +48 grados
        const bgSaturation = 1.2 + (highs * 0.6) + (mids * 0.3); // 1.2 a 2.1
        const bgBrightness = 1.1 + (highMids * 0.35) + (highs * 0.25); // 1.1 a 1.7
        
        document.documentElement.style.setProperty('--bg-hue', `${bgHue}deg`);
        document.documentElement.style.setProperty('--bg-saturation', bgSaturation);
        document.documentElement.style.setProperty('--bg-brightness', bgBrightness);
    }

    /**
     * Actualiza el botón de play/pause personalizado
     */
    function updateCustomPlayButton() {
        if (!elements.customPlayBtn) {
            return;
        }
        
        const icon = elements.customPlayBtn.querySelector('i');
        if (elements.audio.paused) {
            icon.className = 'fas fa-play';
        } else {
            icon.className = 'fas fa-pause';
        }
    }

    /**
     * Actualiza el botón de mute
     */
    function updateMuteButton() {
        if (!elements.customMuteBtn) {
            return;
        }
        
        const icon = elements.customMuteBtn.querySelector('i');
        if (elements.audio.muted || elements.audio.volume === 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (elements.audio.volume < 0.5) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    /**
     * Muestra temporalmente el porcentaje de volumen en el cover
     * @param {number} volumePercent - Porcentaje de volumen (0-100)
     */
    function showVolumePercentage(volumePercent) {
        const volumeIndicator = document.getElementById('volumeIndicator');
        if (!volumeIndicator) {
            return;
        }

        // Limpiar timeout anterior si existe
        if (state.volumeDisplayTimeout) {
            clearTimeout(state.volumeDisplayTimeout);
        }

        // Actualizar el texto y mostrar
        volumeIndicator.textContent = `${Math.round(volumePercent)}%`;
        volumeIndicator.classList.add('show');

        // Después de 2 segundos, ocultar
        state.volumeDisplayTimeout = setTimeout(() => {
            volumeIndicator.classList.remove('show');
        }, 2000);
    }

    /**
     * Actualiza el slider de volumen con el valor actual
     */
    function updateVolumeSlider() {
        if (!elements.volumeSlider) {
            return;
        }
        
        const volume = elements.audio.volume * 100;
        elements.volumeSlider.value = volume;
        
        // Actualizar variable CSS para el track del slider
        elements.volumeSlider.style.setProperty('--volume-percentage', `${volume}%`);
    }

    /**
     * Detiene el visualizador de audio
     */
    function stopLogoVisualization() {
        state.isVisualizerActive = false;
        
        if (elements.logo) {
            elements.logo.style.transform = '';
            elements.logo.style.filter = '';
        }
        
        if (elements.backgroundOverlay) {
            elements.backgroundOverlay.style.opacity = '0.4';
            elements.backgroundOverlay.style.filter = '';
            elements.backgroundOverlay.style.transform = '';
        }
        
        // Reset body background
        document.documentElement.style.setProperty('--bg-hue', '0deg');
        document.documentElement.style.setProperty('--bg-saturation', '1');
        document.documentElement.style.setProperty('--bg-brightness', '1');
    }


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
     * Aplica un fade-in suave al volumen para evitar sustos en primera reproducción
     * @param {number} targetVolume - Volumen objetivo (0-1)
     * @param {number} duration - Duración del fade en milisegundos
     */
    function fadeInVolume(targetVolume, duration = 2500) {
        // Limpiar cualquier fade anterior
        if (state.volumeFadeInterval) {
            clearInterval(state.volumeFadeInterval);
        }
        
        const startVolume = 0;
        const startTime = Date.now();
        const volumeStep = 0.01; // Incremento suave
        const stepDuration = (duration / (targetVolume / volumeStep)); // Calcular intervalo
        
        console.log(`🔊 Fade-in: 0 → ${targetVolume} en ${duration}ms`);
        
        state.volumeFadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1); // 0 a 1
            const currentVolume = startVolume + (targetVolume * progress);
            
            elements.audio.volume = currentVolume;
            
            // Actualizar slider visual
            if (elements.volumeSlider) {
                elements.volumeSlider.value = Math.round(currentVolume * 100);
                updateVolumeSlider();
            }
            
            // Terminar fade cuando alcance el objetivo
            if (progress >= 1) {
                clearInterval(state.volumeFadeInterval);
                state.volumeFadeInterval = null;
                elements.audio.volume = targetVolume;
                console.log('✅ Fade-in completado');
            }
        }, 50); // Actualización cada 50ms para suavidad
    }

    /**
     * Reproduce el audio de la emisora
     */
    async function playAudio() {
        try {
            // Establecer la fuente solo si no está configurada
            if (!elements.audio.src || elements.audio.src === window.location.href || elements.audio.src === '') {
                console.log('🎵 Configurando stream URL:', CONFIG.STREAM_URL);
                elements.audio.src = CONFIG.STREAM_URL;
                // Cargar el audio
                elements.audio.load();
                // Pequeña pausa para que el navegador procese el src
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Fade-in suave en primera reproducción para evitar sustos
            const targetVolume = elements.volumeSlider ? elements.volumeSlider.value / 100 : 1.0;
            if (state.isFirstPlay) {
                console.log('🎵 Primera reproducción - fade-in suave desde 0 a', targetVolume);
                elements.audio.volume = 0; // Iniciar en silencio
                state.isFirstPlay = false;
            }
            
            console.log('▶️ Iniciando reproducción...');
            await elements.audio.play();
            state.userPaused = false;
            state.retryCount = 0; // Resetear contador de reintentos
            console.log('✅ Audio reproduciendo correctamente');
            
            // Aplicar fade-in de volumen si estaba en 0
            if (elements.audio.volume === 0) {
                fadeInVolume(targetVolume, 2500); // 2.5 segundos de fade
            }
            
            // Inicializar visualizador de audio después de que el audio empiece
            setTimeout(() => {
                if (!state.audioContext && !elements.audio.paused) {
                    initializeAudioVisualizer();
                } else if (state.audioContext && state.audioContext.state === 'suspended') {
                    state.audioContext.resume();
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error al reproducir el audio:', error.name, '-', error.message);
            
            // Si es un error de CORS o red
            if (error.name === 'NotSupportedError' || error.message.includes('CORS') || error.message.includes('sources')) {
                console.warn('⚠️ Problema con el stream. Verifica:');
                console.warn('1. Que el servidor de streaming esté activo');
                console.warn('2. Que los headers CORS estén configurados');
                console.warn('3. La URL del stream sea correcta:', CONFIG.STREAM_URL);
            }
            
            // Reintentar solo si no es por pausa del usuario y no excede reintentos
            if (!state.userPaused && state.retryCount < state.maxRetries) {
                state.retryCount++;
                console.log(`🔄 Reintento ${state.retryCount}/${state.maxRetries} en 2 segundos...`);
                setTimeout(playAudio, CONFIG.RETRY_DELAY);
            } else if (state.retryCount >= state.maxRetries) {
                console.error('❌ Máximo de reintentos alcanzado. Por favor, verifica el servidor de streaming.');
                state.retryCount = 0;
            }
        }
    }

    /**
     * Pausa el audio de la emisora
     */
    function pauseAudio() {
        state.userPaused = true;
        elements.audio.pause();
        
        // Suspender el contexto de audio para ahorrar recursos
        if (state.audioContext && state.audioContext.state === 'running') {
            state.audioContext.suspend();
        }
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
            elements.song.setAttribute('data-text', livename);
        }
        
        document.title = livetitle;
        
        if (!state.showingKickVideo && elements.cover) {
            elements.cover.src = liveart;
        }
    }

    /**
     * Actualiza el cover con transición animada y PRECARGA la imagen
     * @param {string} newCoverUrl - URL del nuevo cover
     */
    function updateCoverWithTransition(newCoverUrl) {
        if (!elements.cover || state.currentCoverUrl === newCoverUrl) {
            return;
        }

        // PRECARGAR la imagen antes de iniciar la animación
        const preloadImg = new Image();
        preloadImg.onload = () => {
            // Ahora que la imagen está cargada, iniciar animación de salida
            elements.cover.classList.add('cover-exit');
            
            setTimeout(() => {
                // Cambiar la imagen (ya está precargada)
                elements.cover.src = newCoverUrl;
                state.currentCoverUrl = newCoverUrl;
                elements.audio.setAttribute('poster', newCoverUrl);
                
                // Quitar clase de salida y agregar clase de entrada
                elements.cover.classList.remove('cover-exit');
                elements.cover.classList.add('cover-enter');
                
                setTimeout(() => {
                    elements.cover.classList.remove('cover-enter');
                }, 650);
            }, 350);
        };
        
        preloadImg.onerror = () => {
            // Si falla la precarga, usar fallback sin animación
            console.warn('Error al precargar cover:', newCoverUrl);
            elements.cover.src = newCoverUrl;
            state.currentCoverUrl = newCoverUrl;
        };
        
        preloadImg.src = newCoverUrl;
    }

    /**
     * Actualiza la UI con información de la canción actual
     * @param {Object} radioData - Datos de la radio
     */
    function updateSongInfoUI(radioData) {
        if (!radioData?.now_playing?.song) {
            if (!state.showingKickVideo && elements.cover) {
                updateCoverWithTransition(CONFIG.DEFAULT_COVER);
            }
            if (elements.song) {
                elements.song.textContent = CONFIG.DEFAULT_TITLE;
                elements.song.setAttribute('data-text', CONFIG.DEFAULT_TITLE);
            }
            document.title = CONFIG.DEFAULT_TITLE;
            return;
        }

        const { artist, title: songTitle, art, id: songId } = radioData.now_playing.song;
        const { mainArtist, formattedTitle } = parseArtistInfo(artist, songTitle);
        const songText = `Escuchas: ${mainArtist} - ${formattedTitle}`;

        // Detectar cambio de canción por ID
        const songChanged = state.lastSongId !== null && state.lastSongId !== songId;
        state.lastSongId = songId;

        if (!state.showingKickVideo && elements.cover) {
            const coverUrl = art || CONFIG.DEFAULT_COVER;
            if (songChanged || state.currentCoverUrl !== coverUrl) {
                updateCoverWithTransition(coverUrl);
            }
        }
        
        if (elements.song) {
            elements.song.textContent = songText;
            elements.song.setAttribute('data-text', songText);
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
     * Inicializa la reproducción automática (solo si el navegador lo permite)
     */
    async function initializeAutoplay() {
        // No intentar autoplay por defecto para evitar errores
        // El usuario debe hacer clic en el botón de play
        setTimeout(async () => {
            // Solo ocultar el overlay si ya está reproduciendo (caso raro)
            if (!elements.audio.paused) {
                elements.overlay.style.display = 'none';
                elements.logo.classList.add('active');
                
                // Si ya está reproduciendo, inicializar visualizador
                if (!state.audioContext) {
                    initializeAudioVisualizer();
                }
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
        elements.backgroundOverlay = document.getElementById('backgroundOverlay');
        elements.customPlayBtn = document.getElementById('customPlayBtn');
        elements.customMuteBtn = document.getElementById('customMuteBtn');
        elements.volumeSlider = document.getElementById('volumeSlider');
        elements.volumePopup = document.getElementById('volumePopup');
        elements.volumePopupSlider = document.getElementById('volumePopupSlider');
        elements.volumePopupValue = document.getElementById('volumePopupValue');
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
        // Botón de reproducción inicial (overlay)
        elements.playButton.addEventListener('click', async () => {
            await playAudio();
            elements.overlay.style.display = 'none';
            elements.logo.classList.add('active');
            updateCustomPlayButton();
        });

        // Botón de play/pause personalizado
        elements.customPlayBtn.addEventListener('click', async () => {
            if (elements.audio.paused) {
                await playAudio();
            } else {
                elements.audio.pause();
            }
            updateCustomPlayButton();
        });

        // Slider de volumen
        elements.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            elements.audio.volume = volume;
            updateVolumeSlider();
            
            // Mostrar porcentaje en el botón temporalmente
            showVolumePercentage(e.target.value);
            
            // Sincronizar con popup slider
            if (elements.volumePopupSlider) {
                elements.volumePopupSlider.value = e.target.value;
                if (elements.volumePopupValue) {
                    elements.volumePopupValue.textContent = `${e.target.value}%`;
                }
            }
            
            // Actualizar botón de mute según volumen
            if (volume === 0) {
                elements.audio.muted = true;
            } else if (elements.audio.muted) {
                elements.audio.muted = false;
            }
            updateMuteButton();
        });

        // ========== POPUP DE VOLUMEN PARA MÓVILES ==========
        // Botón de mute/volume con popup adaptativo
        elements.customMuteBtn.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 400;
            
            // Debug para desarrollo
            console.log('Botón volumen clickeado:', {
                windowWidth: window.innerWidth,
                isMobile,
                popupExists: !!elements.volumePopup
            });
            
            // En pantallas grandes: mute/unmute tradicional
            if (!isMobile) {
                elements.audio.muted = !elements.audio.muted;
                updateMuteButton();
                return;
            }
            
            // En móviles con popup disponible: toggle popup
            if (elements.volumePopup) {
                e.stopPropagation();
                const wasShowing = elements.volumePopup.classList.contains('show');
                elements.volumePopup.classList.toggle('show');
                console.log('Popup toggled:', !wasShowing);
            } else {
                console.warn('Popup de volumen no encontrado en el DOM');
            }
        });

        // Slider del popup (si existe)
        if (elements.volumePopupSlider) {
            elements.volumePopupSlider.addEventListener('input', (e) => {
                const volume = e.target.value / 100;
                elements.audio.volume = volume;
                
                // Sincronizar con slider horizontal
                if (elements.volumeSlider) {
                    elements.volumeSlider.value = e.target.value;
                }
                
                // Actualizar texto del popup
                if (elements.volumePopupValue) {
                    elements.volumePopupValue.textContent = `${e.target.value}%`;
                }
                
                // Mostrar porcentaje en el botón temporalmente
                showVolumePercentage(e.target.value);
                
                updateVolumeSlider();
                
                // Actualizar botón de mute según volumen
                if (volume === 0) {
                    elements.audio.muted = true;
                } else if (elements.audio.muted) {
                    elements.audio.muted = false;
                }
                updateMuteButton();
            });
        }

        // Cerrar popup al hacer clic fuera
        if (elements.volumePopup) {
            document.addEventListener('click', (e) => {
                if (elements.volumePopup.classList.contains('show') &&
                    !elements.volumePopup.contains(e.target) &&
                    !elements.customMuteBtn.contains(e.target)) {
                    elements.volumePopup.classList.remove('show');
                }
            });
        }

        // Audio playing - asegurar que el visualizador esté activo
        elements.audio.addEventListener('playing', () => {
            console.log('🎵 Audio playing event');
            updateCustomPlayButton();
            if (!state.audioContext) {
                setTimeout(() => {
                    initializeAudioVisualizer();
                }, 100);
            } else if (state.audioContext.state === 'suspended') {
                state.audioContext.resume();
            }
        });

        // Audio paused - suspender visualizador
        elements.audio.addEventListener('pause', () => {
            console.log('⏸️ Audio paused event');
            updateCustomPlayButton();
            if (state.audioContext && state.audioContext.state === 'running') {
                state.audioContext.suspend();
            }
        });

        // Audio error
        elements.audio.addEventListener('error', (e) => {
            console.error('❌ Error en elemento audio:', e);
            if (elements.audio.error) {
                console.error('Código de error:', elements.audio.error.code);
                console.error('Mensaje:', elements.audio.error.message);
            }
        });

        // Audio stalled
        elements.audio.addEventListener('stalled', () => {
            console.warn('⚠️ Audio stalled - reconectando...');
        });

        // Audio waiting
        elements.audio.addEventListener('waiting', () => {
            console.log('⏳ Buffering...');
        });

        // Audio canplay
        elements.audio.addEventListener('canplay', () => {
            console.log('✅ Audio listo para reproducir');
        });

        // Audio ended
        elements.audio.addEventListener('ended', () => {
            console.log('🔚 Audio ended');
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

