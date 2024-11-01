document.addEventListener('DOMContentLoaded', function () {
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
    const defaultTitle = 'La Urban · Emisora Online';
    const defaultCover = 'https://laurban.cl/img/default.jpg';
    let isKickLive = false;
    let showingKickVideo = false;
    let iframeLoaded = false;
    let iframe2Loaedad = false;
    let userPaused = false;
    let retryCount = 0;

    function setThemeByTime() {
        const hour = new Date().getHours();
        document.body.style.background = hour >= 6 && hour < 18
            ? 'linear-gradient(135deg, #f89200, #facc22)'
            : 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
    }

    function enableCanvas() {
        dynamicCanvas.onclick = (event) => {
            event.preventDefault();
            if (!iframe2Loaedad) {
                button2Text.textContent = 'Cargando...';
                dynamicCanvas.disabled = true;
                newRequestFrame.onload = () => {
                    chatCanvas.classList.add('open');
                    button2Text.textContent = 'Chat en vivo';
                    dynamicCanvas.disabled = false;
                    iframe2Loaedad = true;
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
                    { src: albumArt, sizes: '512x512', type: 'image/jpeg' },
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => playAudio());
            navigator.mediaSession.setActionHandler('pause', () => pauseAudio());
            navigator.mediaSession.setActionHandler('stop', () => pauseAudio());
        }
    }

    function playAudio() {
        audio.src = 'https://radio.laurban.cl:8000/media';
        audio.play().catch(error => console.error('Error al reproducir el audio:', error));
    }

    function pauseAudio() {
        userPaused = true;
        audio.pause();
    }

    function initializePlayer() {
        if (!userPaused) playAudio();
    }

    function getRadioData() {
        return fetch('https://radio.laurban.cl/api/nowplaying/la_urban')
            .then(response => response.json())
            .catch(error => console.error('Error al obtener la información de la canción:', error));
    }

    async function getKickLiveInfo() {
        return await fetch('https://kick.com/api/v2/channels/laurban/livestream')
            .then(response => res = response.json())
            .then(data => data.data != null)
            .catch(error => console.error('Error al obtener la info de kick:', error));
    }

    function showKickVideo() {
        showingKickVideo = true;
        // Ajustar el tamaño del contenedor del reproductor
        const playerContainer = document.querySelector('.player-container');
        playerContainer.style.maxWidth = '800px';
        // Ajustar el tamaño del logo
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
        // Restaurar el tamaño original del contenedor del reproductor
        const playerContainer = document.querySelector('.player-container');
        playerContainer.style.maxWidth = '400px';

        // Restaurar el tamaño original del logo
        const logo = document.getElementById('logo');
        logo.style.maxWidth = '100%';
        showingKickVideo = false;
    }

    async function updateSongInfo() {
        setThemeByTime();
        retryPlayAudio();
        enableCanvas();
        try {
            const [radioData, kickLive] = await Promise.all([getRadioData(), getKickLiveInfo()]);

            isKickLive = kickLive;
            const isLive = radioData.live.is_live;

            if (isLive) {
                var livename = `En vivo: ${radioData.live.streamer_name}` || '¡En Vivo!';
                var liveart = radioData.live.art || defaultCover;
                var livetitle = `La Urban · ${livename}`

                song.textContent = livename; // setea el nombre del programa
                document.title = livetitle; // setea el titulo de la pagina
               if (!showingKickVideo) cover.src = liveart; // setea la imagen del programa
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
            
            if (isKickLive) {
                changeMediaData(radioData, true);
                if (!showingKickVideo) {
                    showingKickVideo = true;
                    showKickVideo();
                }
            } else {
                if (showingKickVideo) {
                    hideKickVideo();
                }
                changeMediaData(radioData);
                const isLive = radioData.live.is_live;
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
                            requestIframe.src = 'https://radio.laurban.cl/public/la_urban/embed-requests?theme=dark';
                        } else {
                            musicRequestCanvas.classList.toggle('open');
                        }
                    };
                }

            }
            // const nextSong = document.getElementById('next-song');
            // if (isLive) {
            //     nextSong.textContent = '¡Estamos en vivo!';
            // } else if (data.playing_next && data.playing_next.song) {
            //     const { artist, title: nextTitle } = data.playing_next.song;
            //     const [mainArtist, extraArtist] = artist.split(';').map(part => part.trim());
            //     const nextSongName = extraArtist && !nextTitle.includes(extraArtist)
            //         ? `${nextTitle} (feat. ${extraArtist})`
            //         : nextTitle;
            //     nextSong.textContent = `Ya viene: ${mainArtist} - ${nextSongName}`;
            // } else {
            //     nextSong.textContent = defaultTitle;
            // }
        } catch (error) {
            console.error('Error al obtener la información:', error);
        }
    }

    function retryPlayAudio() {
        if (!userPaused && audio.paused) {
            if (retryCount < 3) {
                setTimeout(() => {
                    playAudio();
                    retryCount++;
                    retryPlayAudio();
                }, 20000); // 20 segundos entre cada intento
            } else {
                setTimeout(() => {
                    location.reload();
                }, 15000); // Recargar la página después de 15 segundos
            }
        }
    }

    playButton.addEventListener('click', () => {
        updateSongInfo();
        initializePlayer();
        overlay.style.display = 'none';
        logo.classList.add('active');
    });

    setTimeout(() => {
        if (audio.paused && !userPaused) {
            playAudio();
        }
        if (!audio.paused) {
            overlay.style.display = 'none';
            logo.classList.add('active');
        }
    }, 3000);

    updateSongInfo();
    setInterval(updateSongInfo, 30000);

    closeButton.addEventListener('click', () => {
        musicRequestCanvas.classList.remove('open');
    });
    
    close2Button.addEventListener('click', () => {
        chatCanvas.classList.remove('open');
    });

    document.addEventListener('click', (event) => {
        if (!musicRequestCanvas.contains(event.target) && !dynamicButton.contains(event.target)) {
            musicRequestCanvas.classList.remove('open');
        }
        if (!chatCanvas.contains(event.target) && !dynamicCanvas.contains(event.target)) {
            chatCanvas.classList.remove('open');
        }
    });

    // Sincronizar con la transmisión en vivo al pausar y reanudar
    audio.addEventListener('pause', () => userPaused = true);
    audio.addEventListener('play', () => userPaused = false);
});