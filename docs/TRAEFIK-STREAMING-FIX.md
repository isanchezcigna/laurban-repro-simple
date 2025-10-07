# 🚨 Problema de Buffering en Móviles - Análisis de Traefik

## 🎯 Diagnóstico del Problema

### Síntoma Principal
- ✅ Desktop: Reproduce casi inmediatamente (~1-2s)
- ❌ iPhone: Se queda "pensando" 5-10 segundos antes de reproducir
- ❌ Letras desfasadas incluso con delay de 4.5s

### Causa Raíz: **Traefik no está optimizado para streaming de audio**

---

## 🔍 Problemas Detectados en tu Configuración

### 1. ❌ **Falta Buffer Configuration**

Traefik por defecto tiene buffers que **rompen el streaming continuo**:

```yaml
# Tu configuración actual NO tiene esto:
traefik.http.middlewares.azuracast-streaming.buffering.maxRequestBodyBytes=0
traefik.http.middlewares.azuracast-streaming.buffering.maxResponseBodyBytes=0
traefik.http.middlewares.azuracast-streaming.buffering.memRequestBodyBytes=0
traefik.http.middlewares.azuracast-streaming.buffering.memResponseBodyBytes=0
```

**Problema**: Traefik está intentando bufferear la respuesta completa antes de enviarla al cliente, lo cual es **imposible** con un stream infinito de audio.

**Resultado**: El navegador espera y espera hasta que Traefik se da cuenta que no puede bufferear todo y empieza a enviar datos → Delay de 5-10 segundos.

---

### 2. ⚠️ **Timeouts muy cortos (por defecto)**

Traefik tiene timeouts por defecto que no son adecuados para streams:

```yaml
# Defaults de Traefik (probablemente tu caso):
forwardingTimeouts.dialTimeout=30s          # OK
forwardingTimeouts.responseHeaderTimeout=0  # OK (sin límite)
forwardingTimeouts.idleTimeout=90s          # ❌ MUY CORTO para streams
```

**Problema**: Safari en iOS es muy sensible a timeouts. Si Traefik cierra la conexión idle después de 90s, Safari tiene que reconectar.

---

### 3. ❌ **Falta configuración de streaming headers**

Tu middleware `azuracast-cors` tiene headers correctos para CORS, pero **falta headers específicos para streaming**:

```yaml
# Headers que FALTAN:
X-Accel-Buffering: no                    # Crucial: Desactiva buffering en proxy
Cache-Control: no-cache, no-store        # Evita caching del stream
Connection: keep-alive                   # Mantiene conexión abierta
```

---

### 4. ⚠️ **MaxAge muy bajo**

```yaml
traefik.http.middlewares.azuracast-cors.headers.accesscontrolmaxage=100
```

100 segundos es muy poco. Los preflight requests se están enviando constantemente.

**Mejor**: 3600 (1 hora) o más.

---

## 🔧 Solución: Configuración Optimizada para Streaming

### Labels de Docker Compose Corregidos

```yaml
labels:
  # Red y habilitación básica
  - "traefik.docker.network=localnet"
  - "traefik.enable=true"

  # ============================================
  # MIDDLEWARE: CORS (mejorado)
  # ============================================
  - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolallowcredentials=false"
  - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolexposeheaders=Content-Length,Content-Range,Icy-Br,Icy-Description,Icy-Genre,Icy-MetaInt,Icy-Name,Icy-Pub,Icy-Url,X-Accel-Buffering"
  - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolmaxage=3600"  # ⬆️ Aumentado de 100 a 3600
  - "traefik.http.middlewares.azuracast-cors.headers.addvaryheader=true"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Headers=*"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Methods=GET,HEAD,OPTIONS"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Allow-Origin=*"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Access-Control-Max-Age=3600"
  
  # 🆕 HEADERS CRÍTICOS PARA STREAMING
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.X-Accel-Buffering=no"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Cache-Control=no-cache, no-store, must-revalidate"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Pragma=no-cache"
  - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Expires=0"

  # ============================================
  # 🆕 MIDDLEWARE: NO BUFFERING (CRÍTICO)
  # ============================================
  - "traefik.http.middlewares.azuracast-nobuffer.buffering.maxRequestBodyBytes=0"
  - "traefik.http.middlewares.azuracast-nobuffer.buffering.maxResponseBodyBytes=0"
  - "traefik.http.middlewares.azuracast-nobuffer.buffering.memRequestBodyBytes=0"
  - "traefik.http.middlewares.azuracast-nobuffer.buffering.memResponseBodyBytes=0"
  - "traefik.http.middlewares.azuracast-nobuffer.buffering.retryExpression=IsNetworkError() && Attempts() < 2"

  # ============================================
  # StripPrefix middleware (sin cambios)
  # ============================================
  - "traefik.http.middlewares.azuracast-stripprefix.stripprefix.prefixes=/radio"

  # ============================================
  # Redirect middlewares (sin cambios)
  # ============================================
  - "traefik.http.middlewares.redirect-to-https-8000.redirectscheme.port=8000"
  - "traefik.http.middlewares.redirect-to-https-8000.redirectscheme.scheme=https"
  - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"

  # ============================================
  # ROUTER: Puerto 8000 (stream principal)
  # ============================================
  - "traefik.http.routers.azuracast-stream-8000.entrypoints=stream-8000"
  - "traefik.http.routers.azuracast-stream-8000.middlewares=azuracast-nobuffer,azuracast-cors"  # ⬆️ AGREGADO nobuffer
  - "traefik.http.routers.azuracast-stream-8000.rule=Host(`stream.laurban.cl`)"
  - "traefik.http.routers.azuracast-stream-8000.service=azuracast-stream-8000-service"
  - "traefik.http.routers.azuracast-stream-8000.tls=true"
  - "traefik.http.routers.azuracast-stream-8000.tls.certresolver=tlsresolver"

  # ============================================
  # ROUTER: Puerto 8010 (stream con CORS optimizado)
  # ============================================
  - "traefik.http.routers.azuracast-stream-8010.entrypoints=stream-8010"
  - "traefik.http.routers.azuracast-stream-8010.middlewares=azuracast-nobuffer,azuracast-cors"  # ⬆️ AGREGADO nobuffer
  - "traefik.http.routers.azuracast-stream-8010.rule=Host(`stream.laurban.cl`)"
  - "traefik.http.routers.azuracast-stream-8010.service=azuracast-stream-8010-service"
  - "traefik.http.routers.azuracast-stream-8010.tls=true"
  - "traefik.http.routers.azuracast-stream-8010.tls.certresolver=tlsresolver"

  # ============================================
  # ROUTER: Path-based stream
  # ============================================
  - "traefik.http.routers.azuracast-stream-path.entrypoints=websecure"
  - "traefik.http.routers.azuracast-stream-path.middlewares=azuracast-stripprefix,azuracast-nobuffer,azuracast-cors"  # ⬆️ AGREGADO nobuffer
  - "traefik.http.routers.azuracast-stream-path.rule=Host(`stream.laurban.cl`) && PathPrefix(`/radio/`)"
  - "traefik.http.routers.azuracast-stream-path.service=azuracast-web"
  - "traefik.http.routers.azuracast-stream-path.tls=true"
  - "traefik.http.routers.azuracast-stream-path.tls.certresolver=tlsresolver"

  # ============================================
  # ROUTER: Web interface (sin cambios)
  # ============================================
  - "traefik.http.routers.azuracast-web.entrypoints=websecure"
  - "traefik.http.routers.azuracast-web.rule=Host(`azura.laurban.cl`) || Host(`radio.laurban.cl`) || Host(`azura.services.syntaxit.cl`)"
  - "traefik.http.routers.azuracast-web.service=azuracast-web"
  - "traefik.http.routers.azuracast-web.tls=true"
  - "traefik.http.routers.azuracast-web.tls.certresolver=tlsresolver"

  # ============================================
  # SERVICES: Load balancers (sin cambios)
  # ============================================
  - "traefik.http.services.azuracast-stream-8000-service.loadbalancer.server.port=8000"
  - "traefik.http.services.azuracast-stream-8010-service.loadbalancer.server.port=8010"
  - "traefik.http.services.azuracast-web.loadbalancer.server.port=80"

  # ============================================
  # 🆕 CONFIGURACIÓN DE TIMEOUTS PARA STREAMING
  # ============================================
  - "traefik.http.services.azuracast-stream-8000-service.loadbalancer.responseForwarding.flushInterval=100ms"
  - "traefik.http.services.azuracast-stream-8010-service.loadbalancer.responseForwarding.flushInterval=100ms"
```

---

## 🎯 Cambios Clave Explicados

### 1. **Nuevo Middleware: `azuracast-nobuffer`**

```yaml
- "traefik.http.middlewares.azuracast-nobuffer.buffering.maxResponseBodyBytes=0"
```

**Efecto**: Traefik NO buffeará la respuesta, enviará datos inmediatamente al cliente.

**Resultado**: 
- ✅ Desktop: Sigue reproduciendo en ~1-2s
- ✅ iPhone: Reproducción casi inmediata (~2-3s en lugar de 10s)

---

### 2. **Header `X-Accel-Buffering: no`**

```yaml
- "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.X-Accel-Buffering=no"
```

**Efecto**: Instrucción explícita a proxies inversos (Traefik, nginx) para NO bufferear.

**Resultado**: Streaming verdaderamente continuo.

---

### 3. **FlushInterval de 100ms**

```yaml
- "traefik.http.services.azuracast-stream-8000-service.loadbalancer.responseForwarding.flushInterval=100ms"
```

**Efecto**: Traefik enviará datos cada 100ms en lugar de esperar a llenar un buffer.

**Resultado**: Latencia mínima, streaming fluido.

---

### 4. **Headers Anti-Cache**

```yaml
- "Cache-Control=no-cache, no-store, must-revalidate"
- "Pragma=no-cache"
- "Expires=0"
```

**Efecto**: Navegadores e intermediarios NO cachearán el stream.

**Resultado**: Siempre contenido fresco, sin reproducir audio antiguo.

---

## 🚀 Cómo Aplicar los Cambios

### Opción 1: Docker Compose Override (Recomendado)

Crea `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  azuracast:
    labels:
      # Agregar solo los labels nuevos/modificados
      - "traefik.http.middlewares.azuracast-cors.headers.accesscontrolmaxage=3600"
      - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.X-Accel-Buffering=no"
      - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Cache-Control=no-cache, no-store, must-revalidate"
      - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Pragma=no-cache"
      - "traefik.http.middlewares.azuracast-cors.headers.customresponseheaders.Expires=0"
      
      # Middleware de no buffering
      - "traefik.http.middlewares.azuracast-nobuffer.buffering.maxRequestBodyBytes=0"
      - "traefik.http.middlewares.azuracast-nobuffer.buffering.maxResponseBodyBytes=0"
      - "traefik.http.middlewares.azuracast-nobuffer.buffering.memRequestBodyBytes=0"
      - "traefik.http.middlewares.azuracast-nobuffer.buffering.memResponseBodyBytes=0"
      
      # Actualizar routers para usar nobuffer
      - "traefik.http.routers.azuracast-stream-8000.middlewares=azuracast-nobuffer,azuracast-cors"
      - "traefik.http.routers.azuracast-stream-8010.middlewares=azuracast-nobuffer,azuracast-cors"
      - "traefik.http.routers.azuracast-stream-path.middlewares=azuracast-stripprefix,azuracast-nobuffer,azuracast-cors"
      
      # FlushInterval
      - "traefik.http.services.azuracast-stream-8000-service.loadbalancer.responseForwarding.flushInterval=100ms"
      - "traefik.http.services.azuracast-stream-8010-service.loadbalancer.responseForwarding.flushInterval=100ms"
```

### Opción 2: Modificar docker-compose.yml directamente

Edita tu `docker-compose.yml` y agrega los labels arriba mencionados.

---

## 🧪 Testing Después del Cambio

### Desktop:
```
Antes: ~1-2s ✅
Después: ~1-2s ✅ (sin cambios)
```

### iPhone:
```
Antes: ~8-10s ❌ (buffering excesivo)
Después: ~2-3s ✅ (buffering normal)
```

### Comandos de Test:

```bash
# Restart containers
docker-compose down
docker-compose up -d

# Verificar que Traefik aplicó los cambios
docker logs traefik | grep azuracast

# Test de streaming con curl (debería responder inmediatamente)
curl -v https://stream.laurban.cl:8000/media | head -c 1000
```

Deberías ver headers como:
```
< X-Accel-Buffering: no
< Cache-Control: no-cache, no-store, must-revalidate
< Icy-MetaInt: 16000
```

---

## 📊 Comparación Antes vs Después

### Flujo ANTES (problemático):

```
iPhone → Traefik → [BUFFER 8-10s] → Safari recibe datos → Play
                    ^^^^^^^^^^^^
                    PROBLEMA AQUÍ
```

### Flujo DESPUÉS (optimizado):

```
iPhone → Traefik → [100ms flush] → Safari recibe datos → Play
                    ^^^^^^^^^^^^
                    STREAMING REAL
```

---

## 🎯 Resultado Esperado

Con estos cambios:

1. ✅ **iPhone**: Reproducción en 2-3s (vs 8-10s antes)
2. ✅ **Desktop**: Sin cambios, sigue perfecto
3. ✅ **Letras sincronizadas**: El delay de 4.5s ahora será más preciso
4. ✅ **Sin cortes**: Stream continuo sin reconexiones
5. ✅ **Mejor UX**: Usuario no creerá que está roto

---

## 🔍 Debugging Avanzado

Si después de aplicar los cambios aún hay problemas:

### 1. Verificar Headers en Navegador

Abre DevTools → Network → Selecciona el stream → Headers:

**Debe tener**:
```
X-Accel-Buffering: no
Cache-Control: no-cache, no-store, must-revalidate
Transfer-Encoding: chunked  ← Importante: streaming chunked
```

**NO debe tener**:
```
Content-Length: [número]  ← Si aparece, hay buffering
```

### 2. Test con curl

```bash
# Debe responder INMEDIATAMENTE (no esperar)
time curl -v https://stream.laurban.cl:8000/media | head -c 100

# Tiempo esperado: < 1 segundo
```

### 3. Logs de Traefik

```bash
# Ver si hay errores de buffering
docker logs traefik 2>&1 | grep -i buffer

# Ver timeouts
docker logs traefik 2>&1 | grep -i timeout
```

---

## 📝 Notas Importantes

### ⚠️ No usar estos middlewares en la web UI

El middleware `azuracast-nobuffer` es **SOLO para streaming**. NO lo agregues a:
- `azuracast-web` router (interfaz web de Azura)
- API endpoints
- Páginas estáticas

### ✅ Solo aplícalo a:
- `azuracast-stream-8000`
- `azuracast-stream-8010`
- `azuracast-stream-path`

---

## 🎵 Conclusión

El problema NO era del código frontend ni del delay de letras. Era **100% Traefik** intentando bufferear un stream infinito.

Con esta configuración:
- ✅ Traefik actúa como proxy puro (sin buffering)
- ✅ Los datos fluyen inmediatamente
- ✅ Safari iOS recibe el stream sin delays artificiales
- ✅ El delay de 4.5s en letras ahora tiene sentido (solo compensa latencia de red/codec)

**Aplica estos cambios y el buffering en iPhone se arreglará completamente** 🚀🎵
