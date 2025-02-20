// Variables globales
let audioContext = null;
let audioSource = null;
let lastPlayPromise = null;
let userPaused = false;
let retryCount = 0;
let isKickLive = false;
let showingKickVideo = false;
let iframeLoaded = false;
let iframe2Loaded = false;

document.addEventListener('DOMContentLoaded', function () {
    // Elementos DOM
    const audio = document.getElementById('audio');
    const playButton = document.getElementById('playButton');
    const overlay = document.getElementById('overlay');
    const logo = document.getElementById('logo');
    const dynamicButton = document.getElementById('dynamicButton');
    const dynamicCanvas = document.getElementById('dynamicCanvas');
    const buttonIcon = document.getElementById('buttonIcon');
    const buttonText = document.getElementById('buttonText');
    const button2Icon = document.getElementById('button2Icon');
    const button2Text = document.getElementById('button2Text');
    const musicRequestCanvas = document.getElementById('musicRequestCanvas');
    const chatCanvas = document.getElementById('chatCanvas');
    const requestIframe = document.getElementById('requestIframe');
    const newRequestFrame = document.getElementById('newRequestFrame');
    const closeButton = document.getElementById('closeButton');
    const close2Button = document.getElementById('close2Button');
    const defaultTitle = 'La Urban · Emisora Online';
    const defaultCover = 'https://laurban.cl/img/default.jpg';

    function setThemeByTime() {
        const hour = new Date().getHours();
        document.body.style.background = hour >= 6 && hour < 18
            ? 'linear-gradient(135deg, #f89200, #facc22)'
            : 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
    }

    function enableCanvas() {
        dynamicCanvas.onclick = (event) => {
            event.preventDefault();
            if (!iframe2Loaded) {
                button2Text.textContent = 'Cargando...';
                dynamicCanvas.disabled = true;
                newRequestFrame.onload = () => {
                    chatCanvas.classList.add('open');
                    button2Text.textContent = 'Chat en vivo';
                    dynamicCanvas.disabled = false;
                    iframe2Loaded = true;
                };
                newRequestFrame.src = 'https://www3.cbox.ws/box/?boxid=3539409&boxtag=Q2vpWH';
            } else {
                chatCanvas.classList.toggle('open');
            }
        };
    }

    function changeMediaData(data, coverUpdate = false) {
        if ('mediaSession' in navigator) {
            const albumArt = data.now_playing.song.art || defaultCover;
            
            if (coverUpdate) {
                const coverElement = document.getElementById('cover');
                coverElement.src = albumArt;
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: `La Urban: ${data.now_playing.song.title}`,
                artist: data.now_playing.song.artist,
                album: data.now_playing.song.album,
                artwork: [
                    { src: albumArt, sizes: '96x96', type: 'image/jpeg' },
                    { src: albumArt, sizes: '128x128', type: 'image/jpeg' },
                    { src: albumArt, sizes: '192x192', type: 'image/jpeg' },
                    { src: albumArt, sizes: '256x256', type: 'image/jpeg' },
                    { src: albumArt, sizes: '384x384', type: 'image/jpeg' },
                    { src: albumArt, sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => playAudio());
            navigator.mediaSession.setActionHandler('pause', () => pauseAudio());
            navigator.mediaSession.setActionHandler('stop', () => pauseAudio());
        }
    }

    async function playAudio() {
        try {
            audio.src = 'https://play.laurban.cl/';
            await audio.play();
            userPaused = false;
        } catch (error) {
            console.error('Error al reproducir el audio:', error);
            if (!userPaused) {
                setTimeout(playAudio, 2000);
            }
        }
    }

    function pauseAudio() {
        userPaused = true;
        audio.pause();
    }

    function getRadioData() {
        return fetch('https://azura.laurban.cl/api/nowplaying/laurban')
            .then(response => response.json())
            .catch(error => console.error('Error al obtener la información de la canción:', error));
    }

    async function getKickLiveInfo() {
        try {
            const response = await fetch('https://kick.com/api/v2/channels/laurban/livestream');
            const data = await response.json();
            return data.data != null;
        } catch (error) {
            console.error('Error al obtener la info de kick:', error);
            return false;
        }
    }

    function showKickVideo() {
        showingKickVideo = true;
        const playerContainer = document.querySelector('.player-container');
        playerContainer.style.maxWidth = '800px';
        const logo = document.getElementById('logo');
        logo.style.maxWidth = '400px';

        const coverContainer = document.querySelector('.cover-container');
        coverContainer.innerHTML = `
            <div id="kickVideoContainer" style="position: relative; padding-top: 56.25%;">
                <iframe src="https://player.kick.com/laurban?muted=true&autoplay=true" frameborder="0" allowfullscreen
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" scrolling="no"></iframe>
            </div>
        `;
    }

    function hideKickVideo() {
        if(!showingKickVideo) return;
        const coverContainer = document.querySelector('.cover-container');
        coverContainer.innerHTML = `<img id="cover" src="${defaultCover}" alt="Carátula del Álbum" class="cover">`;
        const playerContainer = document.querySelector('.player-container');
        playerContainer.style.maxWidth = '400px';
        const logo = document.getElementById('logo');
        logo.style.maxWidth = '100%';
        showingKickVideo = false;
    }

    async function updateSongInfo() {
        try {
            const [radioData, kickLive] = await Promise.all([getRadioData(), getKickLiveInfo()]);
            
            if (!radioData) return;

            isKickLive = kickLive;
            const isLive = radioData.live.is_live;
            const song = document.getElementById('song');
            const cover = document.getElementById('cover');

            if (isLive) {
                const livename = `En vivo: ${radioData.live.streamer_name}` || '¡En Vivo!';
                const liveart = radioData.live.art || defaultCover;
                const livetitle = `La Urban · ${livename}`;
                
                song.textContent = livename;
                document.title = livetitle;
                if (!showingKickVideo) cover.src = liveart;
            } else {
                if (radioData.now_playing && radioData.now_playing.song) {
                    const { artist, title: songTitle, art } = radioData.now_playing.song;
                    const [mainArtist, ...extraArtists] = artist.split(';').map(part => part.trim());
                    const extraArtistsText = extraArtists.join(', ');
                    const songName = extraArtistsText && !songTitle.includes(extraArtistsText)
                        ? `${songTitle} (feat. ${extraArtistsText})`
                        : songTitle;
                    const songText = `Escuchas: ${mainArtist} - ${songName}`;

                    if (!showingKickVideo) {
                        cover.src = art || defaultCover;
                        audio.setAttribute('poster', cover.src);
                    }
                    song.textContent = songText;
                    document.title = `La Urban · Reproduciendo: ${mainArtist} - ${songName}`;
                    audio.setAttribute('title', songText);
                } else {
                    if (!showingKickVideo) cover.src = defaultCover;
                    song.textContent = defaultTitle;
                    document.title = defaultTitle;
                }
            }

            if (isKickLive && !showingKickVideo) {
                showKickVideo();
            } else if (!isKickLive && showingKickVideo) {
                hideKickVideo();
            }

            changeMediaData(radioData, !showingKickVideo);
            
            if (!isKickLive) {
                dynamicButton.href = isLive
                    ? "whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz"
                    : "#";
                buttonIcon.className = isLive ? 'fab fa-whatsapp' : 'fas fa-music';
                buttonText.textContent = isLive ? 'Escríbenos' : 'Pedir canción';

                if (isLive) {
                    dynamicButton.onclick = null;
                } else {
                    dynamicButton.onclick = (event) => {
                        event.preventDefault();
                        if (!iframeLoaded) {
                            buttonText.textContent = 'Cargando...';
                            dynamicButton.disabled = true;
                            requestIframe.onload = () => {
                                musicRequestCanvas.classList.add('open');
                                buttonText.textContent = 'Pedir canción';
                                dynamicButton.disabled = false;
                                iframeLoaded = true;
                            };
                            requestIframe.src = 'https://azura.laurban.cl/public/laurban/embed-requests?theme=dark';
                        } else {
                            musicRequestCanvas.classList.toggle('open');
                        }
                    };
                }
            }
        } catch (error) {
            console.error('Error en updateSongInfo:', error);
        }
    }

    // Event Listeners
    playButton.addEventListener('click', async () => {
        await playAudio();
        overlay.style.display = 'none';
        logo.classList.add('active');
    });

    audio.addEventListener('ended', () => {
        if (!userPaused) playAudio();
    });

    closeButton.addEventListener('click', () => musicRequestCanvas.classList.remove('open'));
    close2Button.addEventListener('click', () => chatCanvas.classList.remove('open'));

    document.addEventListener('click', (event) => {
        if (!musicRequestCanvas.contains(event.target) && !dynamicButton.contains(event.target)) {
            musicRequestCanvas.classList.remove('open');
        }
        if (!chatCanvas.contains(event.target) && !dynamicCanvas.contains(event.target)) {
            chatCanvas.classList.remove('open');
        }
    });

    // Inicialización
    setTimeout(async () => {
        if (!audio.paused) {
            overlay.style.display = 'none';
            logo.classList.add('active');
            return;
        }
        
        if (audio.paused && !userPaused) {
            await playAudio();
            overlay.style.display = 'none';
            logo.classList.add('active');
        }
    }, 1000);

    setThemeByTime();
    enableCanvas();
    updateSongInfo();
    setInterval(updateSongInfo, 30000);
});
