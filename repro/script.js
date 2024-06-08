document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('audio');
    const currentSongDiv = document.getElementById('current-song');
    const lyricsDiv = document.getElementById('lyrics');
    const azuraCastApiUrl = 'https://radio.laurban.cl/api/nowplaying/laurban';
    const musixmatchApiKey = 'TU_API_KEY_DE_MUSIXMATCH';

    async function fetchCurrentSong() {
        const response = await fetch(azuraCastApiUrl);
        const data = await response.json();
        return data.now_playing.song;
    }

    async function fetchLyrics(trackName, artistName) {
        const response = await fetch(`https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_track=${trackName}&q_artist=${artistName}&apikey=${musixmatchApiKey}`);
        const data = await response.json();
        return data.message.body.lyrics.lyrics_body;
    }

    async function updateSongInfo() {
        const song = await fetchCurrentSong();
        currentSongDiv.textContent = `${song.title} - ${song.artist}`;
        const lyrics = await fetchLyrics(song.title, song.artist);
        lyricsDiv.textContent = lyrics;
    }

    audio.addEventListener('play', updateSongInfo);
    setInterval(updateSongInfo, 30000); // Actualiza cada 30 segundos
});