# 🛠️ Desarrollo Local - La Urban

## Problema: CORS en Desarrollo

Cuando desarrollas localmente (<http://localhost:5500>), el navegador bloquea las peticiones al stream de audio por política de CORS:

```html
Access to audio at 'https://stream.laurban.cl:8000/media' from origin 'http://192.168.50.16:5500' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Soluciones para Desarrollo Local

### Opción 1: Usar un Proxy Local (Recomendado)

Crea un archivo `proxy-server.js` en la raíz del proyecto:

```javascript
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Habilitar CORS para todas las rutas
app.use(cors());

// Servir archivos estáticos
app.use(express.static('.'));

// Proxy para el stream de audio
app.use('/stream', createProxyMiddleware({
    target: 'https://stream.laurban.cl:8000',
    changeOrigin: true,
    pathRewrite: {
        '^/stream': '/media'
    },
    onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Origin', 'https://laurban.cl');
    }
}));

// Proxy para la API
app.use('/api', createProxyMiddleware({
    target: 'https://azura.laurban.cl',
    changeOrigin: true
}));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor proxy corriendo en http://localhost:${PORT}`);
    console.log(`🎵 Stream: http://localhost:${PORT}/stream`);
    console.log(`📡 API: http://localhost:${PORT}/api/nowplaying/laurban`);
});
```

Instalar dependencias:

```bash
npm install express cors http-proxy-middleware
```

Ejecutar el proxy:

```bash
node proxy-server.js
```

Luego en `js/index.js`, cambiar las URLs (solo para desarrollo):

```javascript
// DESARROLLO
STREAM_URL: 'http://localhost:3000/stream',
API_URL: 'http://localhost:3000/api/nowplaying/laurban',

// PRODUCCIÓN (descomentar cuando subas)
// STREAM_URL: 'https://stream.laurban.cl:8000/media',
// API_URL: 'https://azura.laurban.cl/api/nowplaying/laurban',
```

### Opción 2: Extensión del Navegador (Rápido pero menos seguro)

Instala una extensión CORS en Chrome:

- [CORS Unblock](https://chrome.google.com/webstore/detail/cors-unblock)
- [Allow CORS](https://chrome.google.com/webstore/detail/allow-cors-access-control)

⚠️ **Importante:** Desactiva la extensión después de desarrollar.

### Opción 3: Chrome con CORS Deshabilitado

Ejecuta Chrome con un perfil temporal sin CORS:

**Windows:**

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="C:\temp\chrome_dev"
```

**Mac:**

```bash
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev" --disable-web-security
```

**Linux:**

```bash
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

### Opción 4: Usar Firefox con CORS Relajado

```bash
En Firefox, ve a `about:config` y cambia:
- `security.fileuri.strict_origin_policy` → `false`

## Probar el Popup de Volumen sin Audio

Si necesitas probar el popup de volumen sin que funcione el audio, puedes:

1. Abrir las DevTools (F12)
2. Emular un dispositivo móvil (iPhone SE)
3. Hacer clic en el botón de volumen
4. El popup debería aparecer con los logs en consola

Los logs que verás:
```javascript
Botón volumen clickeado: {
    windowWidth: 375,
    isMobile: true,
    popupExists: true
}
Popup toggled: true
```

## Verificar en Producción

En producción (<https://laurban.cl>), el CORS **NO** será un problema porque:

1. El dominio coincide con los headers CORS del servidor
2. HTTPS a HTTPS no tiene problemas de mixed content
3. El servidor ya tiene configurado: `Access-Control-Allow-Origin: *`

## Testing Checklist

- [ ] Popup de volumen aparece en pantallas ≤400px
- [ ] Slider horizontal oculto en móviles
- [ ] Ancho del reproductor adaptativo (90vw en móviles)
- [ ] Botones apilados verticalmente en móviles
- [ ] Carrusel sin cortes
- [ ] Audio funciona (con proxy o en producción)

---

**Tip:** Para desarrollo rápido, usa la Opción 1 (Proxy) y cambia las URLs solo durante el desarrollo.
