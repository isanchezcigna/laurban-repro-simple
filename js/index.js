function closeCanvas() {
    musicRequestCanvas.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', function () {
    function setThemeByTime(theme) {
        var date = new Date();
        var hour = date.getHours();
        var body = document.querySelector('body');
        if (hour >= 6 && hour < 18) {
            body.style.background = 'linear-gradient(135deg, #f89200, #facc22)';
        } else {
            body.style.background = 'linear-gradient(to bottom, rgba(2,7,29) 0%,rgb(8, 30, 77) 100%)';
        }
    }

    function changeMediaData(data) {
        if ('mediaSession' in navigator) {
            const audio = document.getElementById('audio');
            const albumArt = data.now_playing.song.art ? data.now_playing.song.art : 'https://laurban.cl/img/default.jpg';
            // Configura los metadatos de la sesión de medios
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

            // Opcional: Configura los controles de la sesión de medios
            navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
            navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
            navigator.mediaSession.setActionHandler('stop', function () { audio.pause(); });
        }
    }

    var audio = document.getElementById('audio');
    var playButton = document.getElementById('playButton');
    var overlay = document.getElementById('overlay');
    var logo = document.getElementById('logo');

    const dynamicButton = document.getElementById('dynamicButton');
    const buttonIcon = document.getElementById('buttonIcon');
    const buttonText = document.getElementById('buttonText');
    const musicRequestCanvas = document.getElementById('musicRequestCanvas');

    const defaultTitle = 'La Urban · Emisora Online';
    // var hlsUrl = 'https://radio.laurban.cl/hls/laurban/live.m3u8';
    // var mp3Url = 'https://radio.laurban.cl/listen/laurban/aac';

    // generar timeout antes de ejecutar la siguiente linea:
    setTimeout(() => {
        if (audio.paused) {
            playAudio();
        }
        if (!audio.paused) {
            overlay.style.display = 'none';
            logo.classList.add('active'); // Activar la animación del logo
        }
    }, 3000);

    function playAudio() {
        var audio = document.getElementById('audio');
        audio.play().catch(error => {
            console.error('Error al reproducir el audio:', error);
        });
    }

    function initializePlayer() {
        // if (Hls.isSupported()) {
        //     var hls = new Hls();
        //     hls.loadSource(hlsUrl);
        //     hls.attachMedia(audio);
        //     hls.on(Hls.Events.MANIFEST_PARSED, function() {
        //         audio.play().catch(error => {
        //             console.error('Error al reproducir el audio:', error);
        //         });
        //     });
        // } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        //     // Para navegadores que soportan HLS nativamente (como Safari)
        //     audio.src = hlsUrl;
        //     audio.addEventListener('canplay', function() {
        //         audio.play().catch(error => {
        //             console.error('Error al reproducir el audio:', error);
        //         });
        //     });
        // } else {
        // Si no es compatible, usar el flujo MP3

        //audio.addEventListener('canplay', function() {

        // verificar si audio no está en play, darle play:
        if (audio.paused) {
            playAudio();
            var audio = document.getElementById('audio');
            audio.setAttribute('title', document.getElementById('song').textContent);
            audio.setAttribute('poster', document.getElementById('cover').src);
        }
        //});
        //}
        // Pasar información de la canción y la carátula

    }

    playButton.addEventListener('click', function () {
        initializePlayer();
        overlay.style.display = 'none';
        logo.classList.add('active'); // Activar la animación del logo
        updateSongInfo(); // Forzar una actualización al pulsar el botón
    });
    // crear funcion que obtenga y retorne la data para ser usada posteriormente:
    function getRadioData() {
        fetch('https://radio.laurban.cl/api/nowplaying/laurban')
            .then(response => response.json())
            .then(data => {
                return data;
            })
            .catch(error => console.error('Error al obtener la información de la canción:', error));
    }

    function updateSongInfo() {
        const defaultCover = 'https://laurban.cl/img/default.jpg';
        setThemeByTime();
        var data = getRadioData();
        changeMediaData(data);
        if (data.live.is_live) {
            dynamicButton.href = "whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz";
            buttonIcon.className = 'fab fa-whatsapp';
            buttonText.textContent = 'Escríbenos';
            dynamicButton.onclick = null; // Elimina cualquier otro evento onclick
        } else {
            dynamicButton.href = "#"; // Evita que el enlace redirija
            buttonIcon.className = 'fas fa-music';
            buttonText.textContent = 'Pedir canción';
            dynamicButton.onclick = function (event) {
                event.preventDefault(); // Previene la acción por defecto del enlace
                musicRequestCanvas.classList.toggle('open');
            };
        }
        var cover = document.getElementById('cover');
        var song = document.getElementById('song');
        var title = document.title;

        // Verificar que data.now_playing y sus propiedades existen

        if (
            data.now_playing
            && data.now_playing.song
            && data.now_playing.song.artist
            && data.now_playing.song.title
        ) {
            // Extraer la parte antes y después del punto y coma
            var [mainArtist, ...extraArtists] = data.now_playing.song.artist.split(';').map(part => part.trim());

            // Variables para el artista y el título corregidos
            var artistName = mainArtist;
            var songName = data.now_playing.song.title;

            // Extraer los artistas extra y unirlos en un string
            var extraArtistsText = extraArtists.join(', ');

            // Verificar si el título contiene la parte extra del artista
            if (songName.includes(extraArtistsText)) {
                // Si el título contiene la parte extra, solo actualizamos el artist
                artistName = mainArtist;
            } else if (extraArtistsText) {
                // Si no, actualizamos el artist y modificamos el título
                artistName = mainArtist;
                songName = `${songName} (feat. ${extraArtistsText})`;
            } else {
                // Si no hay parte extra, solo actualizamos el artist
                artistName = mainArtist;
            }

            // Crear la variable songText que es el merge de ambas
            var songText = `Escuchas: ${artistName} - ${songName}`;

            // Actualizar la información de la canción
            cover.src = data.now_playing.song.art ? data.now_playing.song.art : defaultCover;
            song.textContent = songText;

            // Actualizar el título de la página
            title = `La Urban · Reproduciendo: ${artistName} - ${songName}`;

            // Pasar información de la canción y la carátula al reproductor
            audio.setAttribute('title', songText);
            audio.setAttribute('poster', cover.src);
        } else {
            // Manejo de caso donde no se obtiene la información esperada
            cover.src = defaultCover;
            song.textContent = defaultTitle;
            title = defaultTitle;
        }

        // hacer lo mismo con el playing_next que sería lo que viene y reemplazar el next-song:
        var nextSong = document.getElementById('next-song');

        if (data.live.is_live) {
            nextSong.textContent = '¡Estamos en vivo!';
        } else {
            if (data.playing_next && data.playing_next.song && data.playing_next.song.artist && data.playing_next.song.title) {
                var [mainArtist, extraArtist] = data.playing_next.song.artist.split(';').map(part => part.trim());
                var artistName = mainArtist;
                var songName = data.playing_next.song.title;
                if (songName.includes(extraArtist)) {
                    artistName = mainArtist;
                } else if (extraArtist) {
                    artistName = mainArtist;
                    songName = `${songName} (feat. ${extraArtist})`;
                } else {
                    artistName = mainArtist;
                }
                var songText = `Ya viene: ${artistName} - ${songName}`;
                nextSong.textContent = songText;
            } else {
                nextSong.textContent = defaultTitle;
            }
        }
    }
/*         fetch('https://radio.laurban.cl/api/nowplaying/laurban')
            .then(response => response.json())
            .then(data => {
                changeMediaData(data);
                if (data.live.is_live) {
                    dynamicButton.href = "whatsapp://send/?phone=+56949242000&abid=+56949242000&text=Escribe%20aca%20tu%20saludo%20y%20pedido%20musical.%20Tambien%20puedes%20enviar%20mensaje%20de%20voz";
                    buttonIcon.className = 'fab fa-whatsapp';
                    buttonText.textContent = 'Escríbenos';
                    dynamicButton.onclick = null; // Elimina cualquier otro evento onclick
                } else {
                    dynamicButton.href = "#"; // Evita que el enlace redirija
                    buttonIcon.className = 'fas fa-music';
                    buttonText.textContent = 'Pedir canción';
                    dynamicButton.onclick = function (event) {
                        event.preventDefault(); // Previene la acción por defecto del enlace
                        musicRequestCanvas.classList.toggle('open');
                    };
                }
                var cover = document.getElementById('cover');
                var song = document.getElementById('song');
                var title = document.title;

                // Verificar que data.now_playing y sus propiedades existen
                if (
                    data.now_playing
                    && data.now_playing.song
                    && data.now_playing.song.artist
                    && data.now_playing.song.title
                ) {
                    // Extraer la parte antes y después del punto y coma
                    var [mainArtist, ...extraArtists] = data.now_playing.song.artist.split(';').map(part => part.trim());

                    // Variables para el artista y el título corregidos
                    var artistName = mainArtist;
                    var songName = data.now_playing.song.title;

                    // Extraer los artistas extra y unirlos en un string
                    var extraArtistsText = extraArtists.join(', ');

                    // Verificar si el título contiene la parte extra del artista
                    if (songName.includes(extraArtistsText)) {
                        // Si el título contiene la parte extra, solo actualizamos el artist
                        artistName = mainArtist;
                    } else if (extraArtistsText) {
                        // Si no, actualizamos el artist y modificamos el título
                        artistName = mainArtist;
                        songName = `${songName} (feat. ${extraArtistsText})`;
                    } else {
                        // Si no hay parte extra, solo actualizamos el artist
                        artistName = mainArtist;
                    }

                    // Crear la variable songText que es el merge de ambas
                    var songText = `Escuchas: ${artistName} - ${songName}`;

                    // Actualizar la información de la canción
                    cover.src = data.now_playing.song.art ? data.now_playing.song.art : defaultCover;
                    song.textContent = songText;

                    // Actualizar el título de la página
                    title = `La Urban · Reproduciendo: ${artistName} - ${songName}`;

                    // Pasar información de la canción y la carátula al reproductor
                    audio.setAttribute('title', songText);
                    audio.setAttribute('poster', cover.src);
                } else {
                    // Manejo de caso donde no se obtiene la información esperada
                    cover.src = defaultCover;
                    song.textContent = defaultTitle;
                    title = defaultTitle;
                }

                // hacer lo mismo con el playing_next que sería lo que viene y reemplazar el next-song:
                var nextSong = document.getElementById('next-song');

                if (data.live.is_live) {
                    nextSong.textContent = '¡Estamos en vivo!';
                } else {
                    if (data.playing_next && data.playing_next.song && data.playing_next.song.artist && data.playing_next.song.title) {
                        var [mainArtist, extraArtist] = data.playing_next.song.artist.split(';').map(part => part.trim());
                        var artistName = mainArtist;
                        var songName = data.playing_next.song.title;
                        if (songName.includes(extraArtist)) {
                            artistName = mainArtist;
                        } else if (extraArtist) {
                            artistName = mainArtist;
                            songName = `${songName} (feat. ${extraArtist})`;
                        } else {
                            artistName = mainArtist;
                        }
                        var songText = `Ya viene: ${artistName} - ${songName}`;
                        nextSong.textContent = songText;
                    } else {
                        nextSong.textContent = defaultTitle;
                    }
                }
            })
            .catch(error => console.error('Error al obtener la información de la canción:', error)); */
    }

    // Actualizar la información de la canción cada 30 segundos
    setInterval(updateSongInfo, 30000);
    // Llamar a la función una vez al cargar la página
    updateSongInfo();

    $('#requestModal').on('shown.bs.modal', function () {
        var iframe = document.getElementById('requestIframe');
        if (!iframe.src) {
            iframe.src = 'https://radio.laurban.cl/public/laurban/embed-requests?theme=dark';
        }
    });
});