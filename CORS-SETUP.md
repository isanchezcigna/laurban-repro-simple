# 🎵 Configuración CORS para Visualizador de Audio

## ⚠️ Problema Actual

El visualizad## 🧪 Verificar CORS

Después de aplicar los cambios, verifica que funcione:

```bash
curl -I https://stream.laurban.cl:8000/media
```

Deberías ver:

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

O desde JavaScript en la consola:

```javascript
fetch('https://stream.laurban.cl:8000/media', { method: 'HEAD' })
  .then(r => console.log(r.headers.get('Access-Control-Allow-Origin')))
``` acceso a los datos del stream mediante Web Audio API. Actualmente, el navegador está bloqueando este acceso debido a restricciones CORS:

```
MediaElementAudioSource outputs zeroes due to CORS access restrictions for https://stream.laurban.cl:8000/media
```

## 📍 URLs del Sistema

- **Frontend**: `laurban.cl`
- **Stream URL (antigua con redirect)**: `play.laurban.cl` → redirige a la URL final
- **Stream URL (final directa)**: `https://stream.laurban.cl:8000/media` ⭐ (Usamos esta ahora)
- **API**: `azura.laurban.cl`

## ✅ Solución: Configurar Headers CORS en el Servidor de Streaming

### **Opción 1: Nginx (Recomendado)**

Si `stream.laurban.cl:8000` está detrás de Nginx, agrega estos headers:

```nginx
# Configuración para el servidor de streaming
server {
    listen 8000 ssl;
    server_name stream.laurban.cl;

    location /media {
        # Headers CORS para Web Audio API
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Range, Content-Type' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range' always;
        
        # Si es una solicitud OPTIONS, responder inmediatamente
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # Tu configuración de proxy existente (Icecast, Shoutcast, etc.)
        proxy_pass http://localhost:8000/media;
        # ... resto de la configuración
    }
}
```

### **Opción 2: Apache**

Si usas Apache, agrega esto al `.htaccess` o configuración del VirtualHost:

```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, OPTIONS"
    Header set Access-Control-Allow-Headers "Range, Content-Type"
    Header set Access-Control-Expose-Headers "Content-Length, Content-Range"
</IfModule>
```

### **Opción 3: AzuraCast / Icecast / Shoutcast**

Si usas AzuraCast, ve a:
1. **Administration** → **System Settings** → **Services**
2. Edita la configuración de **Icecast** o **Shoutcast**
3. Agrega los headers CORS en la configuración del servidor

**Para Icecast**, edita `/etc/icecast2/icecast.xml`:

```xml
<http-headers>
    <header name="Access-Control-Allow-Origin" value="*" />
    <header name="Access-Control-Allow-Methods" value="GET, OPTIONS" />
    <header name="Access-Control-Allow-Headers" value="Range, Content-Type" />
</http-headers>
```

### **Opción 4: Cloudflare (Si lo usas como proxy)**

Si `play.laurban.cl` pasa por Cloudflare:

1. Ve a **Rules** → **Transform Rules** → **HTTP Response Headers**
2. Crea una regla para `play.laurban.cl`:
   - **Set static**: `Access-Control-Allow-Origin` → `*`
   - **Set static**: `Access-Control-Allow-Methods` → `GET, OPTIONS`

## 🧪 Verificar CORS

Después de aplicar los cambios, verifica que funcione:

```bash
curl -I https://play.laurban.cl/
```

Deberías ver:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

O desde JavaScript en la consola:

```javascript
fetch('https://play.laurban.cl/', { method: 'HEAD' })
  .then(r => console.log(r.headers.get('Access-Control-Allow-Origin')))
```

## 🎯 Estado Actual

- ✅ **HTML**: Agregado `crossorigin="anonymous"` al elemento `<audio>`
- ✅ **JavaScript**: El visualizador falla gracefully si CORS está bloqueado
- ✅ **Fallback**: Si no funciona el visualizador, usa animación CSS simple
- ⏳ **Servidor**: Pendiente agregar headers CORS

## 📝 Notas

- El atributo `crossorigin="anonymous"` permite que el navegador solicite CORS
- Sin CORS, el audio **seguirá funcionando**, pero sin efectos visuales reactivos
- El visualizador se degradará automáticamente a una animación CSS simple
- Para desarrollo local (Live Server), no hay problema porque es mismo origen

## 🚀 Una vez configurado CORS

El logo reaccionará al audio con:
- 🎵 Pulso con bass (frecuencias bajas)
- 🎸 Rotación con medios
- ✨ Brillo con agudos
- 💫 Sombra pulsante

Sin CORS, simplemente tendrá una animación de pulso constante.
