# 🔧 Configuración CORS para Traefik - Solución Móvil

## ⚠️ Problema Actual

Los dispositivos móviles (especialmente iOS Safari) requieren headers CORS muy específicos y estrictos.

## ✅ Labels Traefik Completos (AGREGAR ESTOS)

Agrega estos labels que **FALTAN** en tu configuración de AzuraCast:

```yaml
# CORS Headers - SINTAXIS CORRECTA PARA TRAEFIK v3
traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Origin=*
traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Methods=GET,HEAD,OPTIONS
traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Headers=*
traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Max-Age=3600

# Los que ya tienes (MANTENER)
traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowheaders=*
traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowmethods=GET,HEAD,OPTIONS
traefik.http.middlewares.azuracast-cors.headers.accesscontrolmaxage=100
traefik.http.middlewares.azuracast-cors.headers.addvaryheader=true
```

## 📱 Configuración Específica para Móviles

Para máxima compatibilidad móvil, usa esta configuración:

```yaml
# CORS optimizado para móviles
traefik.http.middlewares.azuracast-cors.headers.accesscontrolalloworigin=https://laurban.cl
traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowmethods=GET,POST,OPTIONS,HEAD
traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowheaders=Origin,Content-Type,Accept,Authorization,Cache-Control,X-Requested-With,Range
traefik.http.middlewares.azuracast-cors.headers.accesscontrolexposeheaders=Content-Length,Content-Range,Accept-Ranges,Icy-Br,Icy-Description,Icy-Genre,Icy-MetaInt,Icy-Name,Icy-Pub,Icy-Url
traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowcredentials=false
traefik.http.middlewares.azuracast-cors.headers.accesscontrolmaxage=3600
traefik.http.middlewares.azuracast-cors.headers.addvaryheader=true
```

## 🔄 Comando Docker Compose

Si usas docker-compose, agrega estos labels al servicio de AzuraCast:

```yaml
services:
  azuracast:
    labels:
      # ... tus labels existentes ...
      
      # AGREGAR ESTOS:
      - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolalloworigin=*"
      - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowcredentials=false"
      - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolexposeheaders=Content-Length,Content-Range,Icy-Br,Icy-Description,Icy-Genre,Icy-MetaInt,Icy-Name,Icy-Pub,Icy-Url"
```

## 🧪 Verificación

Después de aplicar los cambios:

```bash
# Verificar headers CORS desde móvil
curl -H "Origin: https://laurban.cl" \
     -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" \
     -I https://stream.laurban.cl:8000/media

# Deberías ver:
# access-control-allow-origin: *
# access-control-allow-methods: GET,POST,OPTIONS,HEAD
# access-control-expose-headers: Content-Length,Content-Range...
```

## 📱 Prueba en Móvil

1. Reinicia el contenedor de AzuraCast
2. Limpia caché del navegador móvil
3. Prueba en modo incógnito/privado
4. El stream debería funcionar sin errores CORS

## 🎯 Notas Importantes

- iOS Safari es el más estricto con CORS
- Android Chrome es más permisivo
- El header `Access-Control-Allow-Origin` es **OBLIGATORIO**
- Sin `accesscontrolexposeheaders`, los metadatos Icy fallarán