var audio = document.getElementById('audio');
var playButton = document.getElementById('playButton');
var overlay = document.getElementById('overlay');
var logo = document.getElementById('logo');
var hlsUrl = 'https://radio.laurban.cl/hls/laurban/live.m3u8';
var mp3Url = 'https://radio.laurban.cl:8000/laurban.mp3';

function initializePlayer() {
    if (Hls.isSupported()) {
        var hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            audio.play().catch(error => {
                console.error('Error al reproducir el audio:', error);
            });
        });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        // Para navegadores que soportan HLS nativamente (como Safari)
        audio.src = hlsUrl;
        audio.addEventListener('canplay', function() {
            audio.play().catch(error => {
                console.error('Error al reproducir el audio:', error);
            });
        });
    } else {
        // Si no es compatible, usar el flujo MP3
        audio.src = mp3Url;
        audio.addEventListener('canplay', function() {
            audio.play().catch(error => {
                console.error('Error al reproducir el audio:', error);
            });
        });
    }
    // Pasar información de la canción y la carátula
    audio.setAttribute('title', document.getElementById('song').textContent);
    audio.setAttribute('poster', document.getElementById('cover').src);
}

playButton.addEventListener('click', function() {
    initializePlayer();
    overlay.style.display = 'none';
    logo.classList.add('active'); // Activar la animación del logo
    updateSongInfo(); // Forzar una actualización al pulsar el botón
});

function updateSongInfo() {
    const defaultCover = 'https://radio.laurban.cl/api/station/laurban/art/842915e20ced6d034c60329bf797f1a4-1715584196.jpg';
    fetch('https://radio.laurban.cl/api/nowplaying/laurban')
        .then(response => response.json())
        .then(data => {
            var cover = document.getElementById('cover');
            var song = document.getElementById('song');
            var title = document.title;

            // Verificar que data.now_playing y sus propiedades existen
            if (data.now_playing && data.now_playing.song && data.now_playing.song.artist && data.now_playing.song.title) {
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
                } else if (extraArtistsText){
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
                document.title = `La Urban · Reproduciendo: ${artistName} - ${songName}`;

                // Pasar información de la canción y la carátula al reproductor
                audio.setAttribute('title', songText);
                audio.setAttribute('poster', cover.src);
            } else {
                // Manejo de caso donde no se obtiene la información esperada
                cover.src = defaultCover;
                song.textContent = 'Artista - Canción';
                document.title = 'La Urban · Reproductor Light';
            }

            // hacer lo mismo con el playing_next que sería lo que viene y reemplazar el next-song:
            var nextSong = document.getElementById('next-song');
            if (data.playing_next && data.playing_next.song && data.playing_next.song.artist && data.playing_next.song.title) {
                var [mainArtist, extraArtist] = data.playing_next.song.artist.split(';').map(part => part.trim());
                var artistName = mainArtist;
                var songName = data.playing_next.song.title;
                if (songName.includes(extraArtist)) {
                    artistName = mainArtist;
                } else if (extraArtist){
                    artistName = mainArtist;
                    songName = `${songName} (feat. ${extraArtist})`;
                } else {
                    artistName = mainArtist;
                }
                var songText = `Ya viene: ${artistName} - ${songName}`;
                nextSong.textContent = songText;
            } else {
                nextSong.textContent = 'Artista - Canción';
            }
        })
        .catch(error => console.error('Error al obtener la información de la canción:', error));
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