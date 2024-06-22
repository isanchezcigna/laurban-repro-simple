document.addEventListener('DOMContentLoaded', function () {
    const audio = document.getElementById('audio');
    const playButton = document.getElementById('playButton');
    const overlay = document.getElementById('overlay');
    const logo = document.getElementById('logo');
    const dynamicButton = document.getElementById('dynamicButton');
    const buttonIcon = document.getElementById('buttonIcon');
    const buttonText = document.getElementById('buttonText');
    const musicRequestCanvas = document.getElementById('musicRequestCanvas');
    const requestIframe = document.getElementById('requestIframe');
    const closeButton = document.getElementById('closeButton');
    const defaultTitle = 'Radio La Mejor · 92.5';
    const defaultCover = 'https://radiolamejor.cl/img/default.jpg';
    let iframeLoaded = false;
    let userPaused = false;
    let retryCount = 0;

    function setThemeByTime() {
        const hour = new Date().getHours();
        document.body.style.background = hour >= 6 && hour < 18
            ? 'linear-gradient(135deg, #f89200, #facc22)'
            : 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
    }

    function changeMediaData(data) {
        if ('mediaSession' in navigator) {
            const albumArt = data.now_playing.song.art || defaultCover;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: `Radio La Mejor: ${data.now_playing.song.title}`,
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
        audio.src = 'https://radio.radiolamejor.cl/listen/lamejor/media';
        audio.play().catch(error => console.error('Error al reproducir el audio:', error));
    }

    function pauseAudio() {
        audio.pause();
        userPaused = true;
    }

    function initializePlayer() {
        if (audio.paused) {
            playAudio();
            audio.setAttribute('title', document.getElementById('song').textContent);
            audio.setAttribute('poster', document.getElementById('cover').src);
        }
    }

    function getRadioData() {
        return fetch('https://radio.radiolamejor.cl/api/nowplaying/lamejor')
            .then(response => response.json())
            .catch(error => console.error('Error al obtener la información de la canción:', error));
    }

    function updateSongInfo() {
        //setThemeByTime();
        getRadioData().then(data => {
            changeMediaData(data);
            console.log(data)
            const isLive = data.live.is_live;
            dynamicButton.href = isLive
                ? "whatsapp://send/?phone=+56997749199&abid=+56997749199&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz"
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
                        requestIframe.src = 'https://radio.radiolamejor.cl/public/lamejor/embed-requests?theme=dark';
                    } else {
                        musicRequestCanvas.classList.toggle('open');
                    }
                };
            }

            if (isLive) {
                var livename = 'Radio La Mejor 92.5 FM // Marchigue, Sexta Región de Chile';
                var liveart = data.live.art || defaultCover;
                var livetitle = `Radio La Mejor · ${livename}`

                song.textContent = livename; // setea el nombre del programa
                cover.src = liveart; // setea la imagen del programa
                document.title = livetitle; // setea el titulo de la pagina
            } else {
                if (data.now_playing && data.now_playing.song) {
                    const { artist, title: songTitle, art } = data.now_playing.song;
                    const [mainArtist, ...extraArtists] = artist.split(';').map(part => part.trim());
                    const extraArtistsText = extraArtists.join(', ');
                    const songName = extraArtistsText && !songTitle.includes(extraArtistsText)
                        ? `${songTitle} (feat. ${extraArtistsText})`
                        : songTitle;
                    const songText = `Escuchas: ${mainArtist} - ${songName}`;
    
                    cover.src = art || defaultCover;
                    song.textContent = songText;
                    document.title = `Radio La Mejor · Reproduciendo: ${mainArtist} - ${songName}`;
                    audio.setAttribute('title', songText);
                    audio.setAttribute('poster', cover.src);
                } else {
                    cover.src = defaultCover;
                    song.textContent = defaultTitle;
                    document.title = defaultTitle;
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
        });
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
        initializePlayer();
        overlay.style.display = 'none';
        logo.classList.add('active');
        updateSongInfo();
    });

    setTimeout(() => {
        if (audio.paused) {
            playAudio();
        }
        if (!audio.paused) {
            overlay.style.display = 'none';
            logo.classList.add('active');
        }
    }, 3000);

    setInterval(updateSongInfo, 30000);
    updateSongInfo();

    closeButton.addEventListener('click', () => {
        musicRequestCanvas.classList.remove('open');
    });

    document.addEventListener('click', (event) => {
        if (!musicRequestCanvas.contains(event.target) && !dynamicButton.contains(event.target)) {
            musicRequestCanvas.classList.remove('open');
        }
    });

    // Sincronizar con la transmisión en vivo al pausar y reanudar
    audio.addEventListener('pause', () => {
        if (!userPaused) {
            retryPlayAudio();
        }
    });

    audio.addEventListener('play', () => {
        if (userPaused) {
            playAudio();
            userPaused = false;
        }
    });
});