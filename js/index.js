document.addEventListener('DOMContentLoaded', function () {
    const audio = document.getElementById('audio');
    const playButton = document.getElementById('playButton');
    const overlay = document.getElementById('overlay');
    const logo = document.getElementById('logo');
    const dynamicButton = document.getElementById('dynamicButton');
    const buttonIcon = document.getElementById('buttonIcon');
    const buttonText = document.getElementById('buttonText');
    const musicRequestCanvas = document.getElementById('musicRequestCanvas');
    const defaultTitle = 'La Urban · Emisora Online';
    const defaultCover = 'https://laurban.cl/img/default.jpg';

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
                title: data.now_playing.song.title,
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

            navigator.mediaSession.setActionHandler('play', () => audio.play());
            navigator.mediaSession.setActionHandler('pause', () => audio.pause());
            navigator.mediaSession.setActionHandler('stop', () => audio.pause());
        }
    }

    function playAudio() {
        audio.play().catch(error => console.error('Error al reproducir el audio:', error));
    }

    function initializePlayer() {
        if (audio.paused) {
            playAudio();
            audio.setAttribute('title', document.getElementById('song').textContent);
            audio.setAttribute('poster', document.getElementById('cover').src);
        }
    }

    function getRadioData() {
        return fetch('https://radio.laurban.cl/api/nowplaying/laurban')
            .then(response => response.json())
            .catch(error => console.error('Error al obtener la información de la canción:', error));
    }

    function updateSongInfo() {
        setThemeByTime();
        getRadioData().then(data => {
            changeMediaData(data);
            const isLive = data.live.is_live;
            dynamicButton.href = isLive
                ? "whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz"
                : "#";
            buttonIcon.className = isLive ? 'fab fa-whatsapp' : 'fas fa-music';
            buttonText.textContent = isLive ? 'Escríbenos' : 'Pedir canción';
            dynamicButton.onclick = isLive ? null : (event) => {
                event.preventDefault();
                musicRequestCanvas.classList.toggle('open');
            };

            const cover = document.getElementById('cover');
            const song = document.getElementById('song');
            const title = document.title;

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
                document.title = `La Urban · Reproduciendo: ${mainArtist} - ${songName}`;
                audio.setAttribute('title', songText);
                audio.setAttribute('poster', cover.src);
            } else {
                cover.src = defaultCover;
                song.textContent = defaultTitle;
                document.title = defaultTitle;
            }

            const nextSong = document.getElementById('next-song');
            if (isLive) {
                nextSong.textContent = '¡Estamos en vivo!';
            } else if (data.playing_next && data.playing_next.song) {
                const { artist, title: nextTitle } = data.playing_next.song;
                const [mainArtist, extraArtist] = artist.split(';').map(part => part.trim());
                const nextSongName = extraArtist && !nextTitle.includes(extraArtist)
                    ? `${nextTitle} (feat. ${extraArtist})`
                    : nextTitle;
                nextSong.textContent = `Ya viene: ${mainArtist} - ${nextSongName}`;
            } else {
                nextSong.textContent = defaultTitle;
            }
        });
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

    $('#requestModal').on('shown.bs.modal', function () {
        const iframe = document.getElementById('requestIframe');
        if (!iframe.src) {
            iframe.src = 'https://radio.laurban.cl/public/laurban/embed-requests?theme=dark';
        }
    });
});