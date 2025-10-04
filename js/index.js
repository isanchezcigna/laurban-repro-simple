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
            message.includes('message channel closed') ||
            message.includes('asynchronous response') ||
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
            e.message.includes('message channel closed') ||
            e.message.includes('asynchronous response') ||
            e.message.includes('chrome.runtime')
        )) {
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
    }, true);

    // Capturar promesas rechazadas (para el error específico que mencionas)
    window.addEventListener('unhandledrejection', function(e) {
        if (e.reason && e.reason.message && (
            e.reason.message.includes('message channel closed') ||
            e.reason.message.includes('asynchronous response') ||
            e.reason.message.includes('Extension context') ||
            e.reason.message.includes('chrome.runtime')
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
        WHATSAPP_URL: 'whatsapp://wa.me/+56949242000?text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz',
        DEFAULT_TITLE: 'La Urban · Emisora Online',
        DEFAULT_COVER: 'https://laurban.cl/img/default.jpg',
        UPDATE_INTERVAL: 5000, // Actualización cada 5 segundos para respuesta más rápida
        INITIAL_DELAY: 500, // Delay inicial más rápido
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
        volumeDisplayTimeout: null, // Timeout para ocultar el porcentaje de volumen
        currentSloganIndex: 0, // Índice del slogan actual
        sloganInterval: null, // Intervalo para cambiar slogans
        currentPlayMessageIndex: 0, // Índice del mensaje de play actual
        playMessageInterval: null // Intervalo para cambiar mensajes de play
    };

    // Frases históricas de La Urban
    const SLOGANS = [
        'agudizando tus sentidos',
        '¡todo el rato!',
        'te pone bien!',
        'un hit en tu ventana',
        'sounds good',
        'se vienen cositas'
    ];

    // Frases insistentes chilenas para el botón de play 😄
    const PLAY_MESSAGES = [
        { text: 'Dale play y disfruta', emoji: '🎧' },
        { text: 'dale play no seas tímido', emoji: '😳' },
        { text: 'dale play mojojojo', emoji: '🐵' },
        { text: 'dale play o andai roando?', emoji: '🔪' },
        { text: 'dale play o andai laando?', emoji: '🧼' },
        { text: 'oye y el play pa cuándo?', emoji: '⏰' },
        { text: 'dale play po compadre', emoji: '🤠' },
        { text: 'apreta el play o te sapeo', emoji: '👀' },
        { text: 'dale play y ponte vío', emoji: '😎' },
        { text: 'el play se va a poner solito?', emoji: '🤔' },
        { text: 'apreta esa wea de play', emoji: '👆' },
        { text: 'dale play antes que me enoje', emoji: '😤' },
        { text: 'que tanto color con el play?', emoji: '🤷' },
        { text: 'dale play o te banneo', emoji: '⛔' },
        { text: 'apreta el play porfaaaaa', emoji: '🥺' }
    ];

    // Referencias a elementos DOM (se inicializarán en DOMContentLoaded)
    const elements = {};

    /**
     * Detecta si estamos en un dispositivo móvil
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }

    /**
     * Detecta si estamos en desarrollo local (localhost o IP local)
     */
    function isLocalDevelopment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' || 
               hostname.startsWith('192.168.') || 
               hostname.startsWith('10.') || 
               hostname.startsWith('172.') ||
               hostname.endsWith('.local');
    }

    /**
     * Inicializa el contexto de audio y el analizador para visualización
     * NOTA: Requiere CORS en el servidor de streaming para funcionar óptimamente
     * En móviles o desarrollo local, se deshabilita automáticamente para evitar problemas de CORS
     */
    function initializeAudioVisualizer() {
        if (state.audioContext) {
            return; // Ya está inicializado
        }

        // En móviles o desarrollo local, NO inicializar el visualizador
        // Esto evita que el audio se silencie por problemas de CORS
        if (isMobileDevice()) {
            console.warn('📱 Dispositivo móvil detectado - Visualizador deshabilitado para evitar problemas de CORS');
            console.log('ℹ️ El audio funcionará perfectamente, pero sin efectos visuales reactivos');
            console.log('💡 Usa animación CSS simple en su lugar');
            
            state.isVisualizerActive = true; // Para que las funciones de visualización sepan que está "activo"
            
            // Aplicar animación CSS simple
            if (elements.logo) {
                elements.logo.classList.add('active');
                elements.logo.style.animation = 'pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite';
            }
            return;
        }

        if (isLocalDevelopment()) {
            console.warn('🔧 Desarrollo local detectado - Visualizador deshabilitado (sin CORS)');
            console.log('ℹ️ El audio funcionará perfectamente, pero sin efectos visuales reactivos');
            console.log('💡 Sube a producción (https://laurban.cl) para ver efectos completos');
            
            state.isVisualizerActive = true;
            
            // Aplicar animación CSS simple
            if (elements.logo) {
                elements.logo.classList.add('active');
                elements.logo.style.animation = 'pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite';
            }
            return;
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
            
            // Intentar conectar el elemento de audio al analizador
            // Esto puede fallar si hay problemas de CORS
            if (!state.audioSource) {
                try {
                    state.audioSource = state.audioContext.createMediaElementSource(elements.audio);
                    state.audioSource.connect(state.analyser);
                    state.analyser.connect(state.audioContext.destination);
                    console.log('✅ Audio source conectado al visualizador');
                } catch (corsError) {
                    console.warn('⚠️ No se pudo conectar el audio al visualizador (CORS):', corsError.message);
                    console.log('ℹ️ El audio funcionará, pero sin análisis de frecuencias en tiempo real');
                    // No crear el source - dejar que el audio se reproduzca normalmente
                    state.audioSource = null;
                }
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
            console.warn('⚠️ No se pudo inicializar el visualizador de audio:', error.message);
            console.log('ℹ️ El audio seguirá funcionando normalmente sin efectos visuales');
            
            // Limpiar el audioSource si falla para evitar problemas
            state.audioSource = null;
            state.audioContext = null;
            state.analyser = null;
            state.isVisualizerActive = false;
            
            // Aplicar animación CSS alternativa si el visualizador falla
            if (elements.logo) {
                elements.logo.style.animation = 'pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite';
            }
        }
    }

    /**
     * Anima el logo basándose en la frecuencia del audio con detección de kick mejorada
     * Si no hay analyser disponible (por CORS), usa animación basada en tiempo
     */
    function startLogoVisualization() {
        if (!state.isVisualizerActive) {
            return;
        }

        // Si no hay analyser (problema de CORS), usar animación simple basada en tiempo
        if (!state.analyser || !state.audioSource) {
            console.log('ℹ️ Usando animación simple (sin análisis de audio)');
            if (elements.logo) {
                elements.logo.style.animation = 'pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite';
            }
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
     * Si no hay analyser disponible (por CORS), usa animación suave constante
     */
    function startBackgroundVisualization() {
        if (!state.isVisualizerActive) {
            return;
        }

        // Si no hay analyser (problema de CORS), usar animación suave constante
        if (!state.analyser || !state.audioSource) {
            console.log('ℹ️ Usando animación de fondo simple (sin análisis de audio)');
            // Las olas ya tienen su movimiento suave en CSS/JS
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

            // Bass para las ondas
            const bassEnd = midStart;
            let bassSum = 0;
            for (let i = 0; i < bassEnd; i++) {
                bassSum += dataArray[i];
            }
            const bassAvg = (bassSum / bassEnd) / 255;

            applyBackgroundEffects(highAvg, highMidAvg, midAvg, bassAvg);
        }

        animateBackground();
    }

    /**
     * Aplica efectos visuales VISIBLES al background basados en frecuencias ALTAS
     * El background reacciona a highs/mids (complementario al logo que reacciona a kick/bass)
     * @param {number} highs - Intensidad de agudos (0-1) - hi-hats, platillos
     * @param {number} highMids - Intensidad de agudos-medios (0-1) - voces agudas
     * @param {number} mids - Intensidad de medios (0-1) - melodías
     * @param {number} bass - Intensidad de bajos (0-1) - para ondas
     */
    function applyBackgroundEffects(highs, highMids, mids, bass) {
        if (!elements.backgroundOverlay) {
            return;
        }

        // Opacidad ULTRA SUTIL - apenas perceptible
        const opacity = 0.09 + (highs * 0.3) + (highMids * 0.15); // 0.02 a 0.065 (ULTRA SUTIL!)
        
        // Hue shift MÁS DRAMÁTICO
        const hueShift = (highs * 60) - (mids * 20); // -20 a +60 grados
        
        // Saturación MÁS INTENSA
        const saturation = 1.2 + (highs * 1.2) + (highMids * 0.5); // 1.2 a 2.9
        
        // Brillo MÁS EVIDENTE
        const brightness = 1.1 + (highMids * 0.7) + (highs * 0.5); // 1.1 a 2.3
        
        // Scale más pronunciado
        const scale = 1 + (highs * 0.18) + (highMids * 0.09); // 1.0 a 1.27
        
        // Aplicar filtros - Opacity muy sutil, otros efectos visibles
        elements.backgroundOverlay.style.opacity = opacity;
        elements.backgroundOverlay.style.filter = `brightness(${brightness}) saturate(${saturation}) hue-rotate(${hueShift}deg)`;
        elements.backgroundOverlay.style.transform = `scale(${scale})`;
        
        // Background texture con cambios MÁS EVIDENTES
        const bgHue = (highMids * 30) + (mids * 18) - (highs * 12); // -12 a +48 grados
        const bgSaturation = 1.2 + (highs * 0.6) + (mids * 0.3); // 1.2 a 2.1
        const bgBrightness = 1.1 + (highMids * 0.35) + (highs * 0.25); // 1.1 a 1.7
        
        document.documentElement.style.setProperty('--bg-hue', `${bgHue}deg`);
        document.documentElement.style.setProperty('--bg-saturation', bgSaturation);
        document.documentElement.style.setProperty('--bg-brightness', bgBrightness);

        // Animar ondas SVG con el audio
        animateWaves(bass, mids, highs);
    }

    /**
     * Anima las ondas SVG basándose en el audio - Movimiento suave como el mar
     * Mantiene morfología original con movimiento fluido constante
     * @param {number} bass - Intensidad de bajos (0-1)
     * @param {number} mids - Intensidad de medios (0-1)
     * @param {number} highs - Intensidad de agudos (0-1)
     */
    function animateWaves(bass, mids, highs) {
        const waveSvg = document.getElementById('waveSvg');
        const wave1 = document.getElementById('wave1');
        const wave2 = document.getElementById('wave2');
        const wave3 = document.getElementById('wave3');
        
        if (!waveSvg || !wave1 || !wave2 || !wave3) return;

        // Determinar si es tema día o noche
        const isDaytime = document.body.classList.contains('theme-day');

        // Opacidad suave - ajustada según el tema
        const overallIntensity = (bass * 0.4) + (mids * 0.3) + (highs * 0.3);
        // Modo noche: más sutil (0.25 a 0.45), Modo día: más visible (0.6 a 0.9)
        const baseOpacity = isDaytime ? 0.6 : 0.25;
        const maxOpacityBoost = isDaytime ? 0.3 : 0.2;
        const waveOpacity = baseOpacity + (overallIntensity * maxOpacityBoost);
        waveSvg.style.opacity = waveOpacity;

        // Escala MUY SUTIL - solo un ligero pulso con los bajos
        const waveScale = 1 + (bass * 0.08); // 1.0 a 1.08 (mucho más sutil)
        waveSvg.style.transform = `scale(${waveScale})`;
        
        // Rangos de HUE según el tema
        let hue1, hue2, hue3;
        if (isDaytime) {
            // Modo DÍA: Naranjas y amarillos (10-50)
            hue1 = 10 + (bass * 30);   // Rojo-naranja a naranja
            hue2 = 25 + (mids * 35);   // Naranja a amarillo
            hue3 = 40 + (highs * 30);  // Amarillo brillante
        } else {
            // Modo NOCHE: Cyans y azules (180-210)
            hue1 = 180 + (bass * 15);  // Cyan
            hue2 = 195 + (mids * 10);  // Cyan-azul
            hue3 = 200 + (highs * 10); // Azul
        }

        // Actualizar los stops de gradiente
        const gradients = ['waveGradient1', 'waveGradient2', 'waveGradient3'];
        const hues = [hue1, hue2, hue3];
        
        gradients.forEach((gradId, idx) => {
            const grad = document.getElementById(gradId);
            if (grad) {
                const stops = grad.querySelectorAll('stop');
                const intensity = idx === 0 ? bass : idx === 1 ? mids : highs;
                // Modo noche: más transparente (0.15 a 0.35), Modo día: normal (0.3 a 0.6)
                const baseOpacityMin = isDaytime ? 0.3 : 0.15;
                const baseOpacityRange = isDaytime ? 0.3 : 0.2;
                const baseOpacity = baseOpacityMin + (intensity * baseOpacityRange);
                
                stops.forEach((stop, stopIdx) => {
                    const stopOpacity = baseOpacity * (stopIdx === 1 ? 1.1 : 1);
                    const saturation = 80 + (intensity * 15); // 80% a 95%
                    const lightness = 50 + (intensity * 15); // 50% a 65%
                    const color = `hsla(${hues[idx]}, ${saturation}%, ${lightness}%, ${stopOpacity})`;
                    stop.setAttribute('style', `stop-color:${color};stop-opacity:1`);
                });
            }
        });

        // MOVIMIENTO SUAVE COMO EL MAR - Mantiene forma original
        // Usar tiempo para crear movimiento continuo y fluido
        const time = Date.now() * 0.001; // Convertir a segundos
        
        // Amplitudes FIJAS base (forma original) con ligera intensificación musical
        const baseAmp1 = 30; // Amplitud base ola 1
        const baseAmp2 = 25; // Amplitud base ola 2
        const baseAmp3 = 20; // Amplitud base ola 3
        
        // La música solo intensifica ligeramente el movimiento natural
        const amp1 = baseAmp1 + (bass * 15); // 30 a 45 (mucho más controlado)
        const amp2 = baseAmp2 + (mids * 12); // 25 a 37
        const amp3 = baseAmp3 + (highs * 10); // 20 a 30

        // Frecuencia FIJA para mantener la morfología
        const freq1 = 360; // Fija
        const freq2 = 360; // Fija
        const freq3 = 360; // Fija

        // Posiciones base fijas
        const y1Base = 160;
        const y2Base = 200;
        const y3Base = 240;

        // Movimiento sinusoidal suave como el mar (siempre activo)
        // Cada ola se mueve a diferente velocidad para efecto más natural
        const wave1Offset = Math.sin(time * 0.5) * amp1;
        const wave2Offset = Math.sin(time * 0.4 + 1) * amp2; // Desfasado
        const wave3Offset = Math.sin(time * 0.3 + 2) * amp3; // Más desfasado

        // Onda 1 - Movimiento suave continuo
        const y1Control = y1Base - wave1Offset;
        wave1.setAttribute('d', 
            `M0,${y1Base} Q${freq1},${y1Control} 720,${y1Base} T1440,${y1Base} L1440,320 L0,320 Z`
        );

        // Onda 2 - Movimiento suave continuo
        const y2Control = y2Base - wave2Offset;
        wave2.setAttribute('d', 
            `M0,${y2Base} Q${freq2},${y2Control} 720,${y2Base} T1440,${y2Base} L1440,320 L0,320 Z`
        );

        // Onda 3 - Movimiento suave continuo
        const y3Control = y3Base - wave3Offset;
        wave3.setAttribute('d', 
            `M0,${y3Base} Q${freq3},${y3Control} 720,${y3Base} T1440,${y3Base} L1440,320 L0,320 Z`
        );
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
     * Inicia la rotación de slogans históricos
     */
    function startSloganRotation() {
        const sloganText = document.getElementById('sloganText');
        if (!sloganText) return;

        // Empezar en posición aleatoria
        state.currentSloganIndex = Math.floor(Math.random() * SLOGANS.length);
        updateSlogan();

        // Rotar cada 8 segundos
        state.sloganInterval = setInterval(() => {
            state.currentSloganIndex = (state.currentSloganIndex + 1) % SLOGANS.length;
            updateSlogan();
        }, 8000);
    }

    /**
     * Actualiza el slogan con animación de fade
     */
    function updateSlogan() {
        const sloganText = document.getElementById('sloganText');
        if (!sloganText) return;

        const slogan = SLOGANS[state.currentSloganIndex];
        
        // Fade out
        sloganText.classList.add('fade-out');
        
        setTimeout(() => {
            // Cambiar texto - siempre "Desde el 2009" + frase rotativa
            sloganText.textContent = `Desde el 2009 ${slogan}`;
            
            // Fade in
            sloganText.classList.remove('fade-out');
            sloganText.classList.add('fade-in');
            
            // Limpiar clase fade-in después de la animación
            setTimeout(() => {
                sloganText.classList.remove('fade-in');
            }, 500);
        }, 500);
    }

    /**
     * Detiene la rotación de slogans
     */
    function stopSloganRotation() {
        if (state.sloganInterval) {
            clearInterval(state.sloganInterval);
            state.sloganInterval = null;
        }
    }

    /**
     * Inicia la rotación de mensajes insistentes para el botón de play 😄
     */
    function startPlayMessageRotation() {
        if (!elements.playText || !elements.playEmoji) return;

        // Empezar con el mensaje inicial por 3 segundos
        setTimeout(() => {
            state.currentPlayMessageIndex = 1; // Empezar con el segundo mensaje
            updatePlayMessage();

            // Rotar mensajes cada 4 segundos después del inicial
            state.playMessageInterval = setInterval(() => {
                state.currentPlayMessageIndex = (state.currentPlayMessageIndex + 1) % PLAY_MESSAGES.length;
                updatePlayMessage();
            }, 4000);
        }, 3000);
    }

    /**
     * Actualiza el mensaje de play con animación
     */
    function updatePlayMessage() {
        if (!elements.playText || !elements.playEmoji) return;

        const message = PLAY_MESSAGES[state.currentPlayMessageIndex];
        
        // Fade out rápido
        elements.playText.style.opacity = '0';
        elements.playText.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            // Cambiar contenido
            elements.playText.innerHTML = `${message.text} <span id="playEmoji">${message.emoji}</span>`;
            elements.playEmoji = document.getElementById('playEmoji'); // Actualizar referencia
            
            // Fade in rápido
            elements.playText.style.opacity = '1';
            elements.playText.style.transform = 'translateY(0)';
        }, 300);
    }

    /**
     * Detiene la rotación de mensajes de play
     */
    function stopPlayMessageRotation() {
        if (state.playMessageInterval) {
            clearInterval(state.playMessageInterval);
            state.playMessageInterval = null;
        }
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
            elements.backgroundOverlay.style.opacity = '0.02'; // Ultra sutil en reposo
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
        
        // Cambiar fondo
        document.body.style.background = isDaytime
            ? 'linear-gradient(135deg, #f89200, #facc22)'
            : 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
        
        // Agregar/quitar clase para cambiar colores de acento
        if (isDaytime) {
            document.body.classList.add('theme-day');
            updateWaveColors('#fc5e16', '#fc9e16', '#ffc832'); // Naranja/Amarillo
        } else {
            document.body.classList.remove('theme-day');
            updateWaveColors('#00d9ff', '#0099ff', '#00ffff'); // Cyan/Azul
        }
        
        console.log(`🌅 Tema actualizado: ${isDaytime ? 'DÍA' : 'NOCHE'} (hora actual: ${hour}:00)`);
    }

    /**
     * Actualiza los colores de las ondas SVG según el tema
     */
    function updateWaveColors(color1, color2, color3) {
        // Convertir hex a rgba
        function hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        // Gradiente 1
        const gradient1 = document.querySelectorAll('#waveGradient1 stop');
        if (gradient1.length >= 3) {
            gradient1[0].style.stopColor = hexToRgba(color1, 0.4);
            gradient1[1].style.stopColor = hexToRgba(color2, 0.5);
            gradient1[2].style.stopColor = hexToRgba(color3, 0.4);
        }

        // Gradiente 2
        const gradient2 = document.querySelectorAll('#waveGradient2 stop');
        if (gradient2.length >= 3) {
            gradient2[0].style.stopColor = hexToRgba(color3, 0.3);
            gradient2[1].style.stopColor = hexToRgba(color2, 0.4);
            gradient2[2].style.stopColor = hexToRgba(color1, 0.3);
        }

        // Gradiente 3
        const gradient3 = document.querySelectorAll('#waveGradient3 stop');
        if (gradient3.length >= 3) {
            gradient3[0].style.stopColor = hexToRgba(color2, 0.25);
            gradient3[1].style.stopColor = hexToRgba(color3, 0.3);
            gradient3[2].style.stopColor = hexToRgba(color1, 0.25);
        }

        console.log(`🌊 Colores de ondas actualizados: ${color1}, ${color2}, ${color3}`);
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
            console.log('🎵 playAudio() llamado');
            
            // Establecer la fuente solo si no está configurada o es inválida
            if (!elements.audio.src || elements.audio.src === window.location.href || elements.audio.src === '') {
                console.log('🎵 Configurando stream URL:', CONFIG.STREAM_URL);
                elements.audio.src = CONFIG.STREAM_URL;
            }
            
            // En móviles, es importante cargar explícitamente
            if (elements.audio.readyState < 2) { // HAVE_CURRENT_DATA
                console.log('🎵 Cargando audio...');
                elements.audio.load();
                // Esperar un poco más en móviles para que cargue
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Fade-in suave en primera reproducción para evitar sustos
            const targetVolume = elements.volumeSlider ? elements.volumeSlider.value / 100 : 1.0;
            if (state.isFirstPlay) {
                console.log('🎵 Primera reproducción - fade-in suave desde 0 a', targetVolume);
                elements.audio.volume = 0; // Iniciar en silencio
                state.isFirstPlay = false;
            }
            
            console.log('▶️ Iniciando reproducción...');
            console.log('📊 Estado del audio:', {
                readyState: elements.audio.readyState,
                networkState: elements.audio.networkState,
                src: elements.audio.src
            });
            
            // Crear una promesa con timeout para evitar que se quede colgado
            const playPromise = elements.audio.play();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: El audio tardó demasiado en cargar')), 10000)
            );
            
            await Promise.race([playPromise, timeoutPromise]);
            
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
            // Agregar timestamp para evitar cache y obtener datos frescos
            // NO usamos headers custom para evitar problemas de CORS preflight
            const timestamp = new Date().getTime();
            const response = await fetch(`${CONFIG.API_URL}?_=${timestamp}`);
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
        
        if (songChanged) {
            console.log(`🎵 Nueva canción: ${mainArtist} - ${formattedTitle}`);
        }
        
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
        elements.playText = document.getElementById('playText');
        elements.playEmoji = document.getElementById('playEmoji');
    }

    /**
     * Configura todos los event listeners
     */
    function setupEventListeners() {
        // Botón de reproducción inicial (overlay)
        elements.playButton.addEventListener('click', async () => {
            // Detener mensajes insistentes cuando se hace clic
            stopPlayMessageRotation();
            
            await playAudio();
            elements.overlay.style.display = 'none';
            elements.logo.classList.add('active');
            
            // Quitar el blur del contenido del reproductor
            const playerContent = document.getElementById('playerContent');
            if (playerContent) {
                playerContent.classList.remove('blurred');
            }
            
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
            document.body.classList.add('audio-playing'); // Mostrar olas SVG
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
            document.body.classList.remove('audio-playing'); // Ocultar olas SVG
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
                
                // Códigos de error específicos
                switch (elements.audio.error.code) {
                    case 1: // MEDIA_ERR_ABORTED
                        console.error('❌ Carga abortada por el usuario');
                        break;
                    case 2: // MEDIA_ERR_NETWORK
                        console.error('❌ Error de red al cargar el stream');
                        console.warn('💡 Verifica tu conexión a internet');
                        break;
                    case 3: // MEDIA_ERR_DECODE
                        console.error('❌ Error al decodificar el audio');
                        break;
                    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                        console.error('❌ Formato de stream no soportado o URL inválida');
                        console.warn('💡 URL del stream:', elements.audio.src);
                        break;
                }
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
        
        // Audio canplaythrough
        elements.audio.addEventListener('canplaythrough', () => {
            console.log('✅ Audio puede reproducirse sin interrupciones');
        });
        
        // Audio loadstart
        elements.audio.addEventListener('loadstart', () => {
            console.log('📥 Comenzando a cargar el stream...');
        });
        
        // Audio loadedmetadata
        elements.audio.addEventListener('loadedmetadata', () => {
            console.log('📊 Metadata del stream cargada');
        });
        
        // Audio loadeddata
        elements.audio.addEventListener('loadeddata', () => {
            console.log('📦 Primeros datos del stream cargados');
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
        // Mostrar pantalla de carga
        showLoadingScreen();
        
        initializeElements();
        setupEventListeners();
        setThemeByTime();
        enableChatCanvas();
        
        // Primera actualización inmediata sin delay
        updateSongInfo();
        
        // Actualizaciones periódicas cada 5 segundos
        setInterval(updateSongInfo, CONFIG.UPDATE_INTERVAL);
        
        initializeAutoplay();
        startSloganRotation(); // Iniciar rotación de frases históricas
        
        // Verificar tema cada 10 minutos por si cambia la hora mientras está abierto
        setInterval(setThemeByTime, 600000); // 10 minutos = 600000ms
        
        // Ocultar pantalla de carga después de que todo esté listo
        hideLoadingScreen();
        
        console.log('🎵 La Urban Player inicializado');
        console.log(`⏱️ Actualización de info cada ${CONFIG.UPDATE_INTERVAL/1000} segundos`);
    }

    /**
     * Muestra la pantalla de carga inicial
     */
    function showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const playerContent = document.getElementById('playerContent');
        
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
        
        if (playerContent) {
            playerContent.classList.add('blurred');
        }
    }

    /**
     * Oculta la pantalla de carga con animación
     */
    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const playerContent = document.getElementById('playerContent');
        
        // Simular tiempo de carga mínimo para que se vea la animación (1.5 segundos)
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
            
            if (playerContent) {
                // Mantener el blur hasta que el usuario haga play
                // playerContent.classList.remove('blurred'); // Se quitará cuando hagan play
            }

            // Iniciar mensajes insistentes después de ocultar pantalla de carga
            startPlayMessageRotation();
        }, 1500);
    }

    // Iniciar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);

})();

