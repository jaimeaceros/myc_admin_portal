# GUÍA DE EJECUCIÓN DE PRUEBAS PARA CLAUDE CODE
## Sistema Mente y Cuerpo Pilates — PP-MYC-2026-01 (v3)
## Arquitectura real confirmada

---

## ARQUITECTURA REAL DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN PORTAL (React/TypeScript)                                │
│  Hetzner VPS — Nginx sirve /dist estático                       │
│  URL: https://138.199.200.150 (o dominio configurado)           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS directo (no hay backend intermedio)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                       │
│  REST API:   https://qhzqtagzndsvwfyljuof.supabase.co/rest/v1/ │
│  Auth API:   https://qhzqtagzndsvwfyljuof.supabase.co/auth/v1/ │
│  Edge Fn:    https://qhzqtagzndsvwfyljuof.supabase.co/functions │
│  Base datos: PostgreSQL (gestionado por Supabase)               │
└─────────────────────────────────────────────────────────────────┘

NOTA: La app móvil Flutter y la integración Wompi no están en
este repo. Sus pruebas quedan pendientes de ejecución manual.
```

---

## VARIABLES DE ENTORNO

```bash
# VPS Hetzner
export VPS_IP="138.199.200.150"
export APP_URL="https://138.199.200.150"   # o dominio si está configurado

# Supabase
export SUPABASE_URL="https://qhzqtagzndsvwfyljuof.supabase.co"
export SUPABASE_ANON_KEY="[ANON KEY del proyecto Supabase]"
export SUPABASE_SERVICE_KEY="[SERVICE ROLE KEY — solo para pruebas, nunca en producción]"

# Credenciales de prueba (crear previamente en Supabase Auth)
export EMAIL_ADMIN="admin.test@menteycuerpo.com"
export PASSWORD_ADMIN="[contraseña de prueba]"
export EMAIL_ENTRENADOR="entrenador.test@menteycuerpo.com"
export PASSWORD_ENTRENADOR="[contraseña de prueba]"

# IDs de prueba (obtener después de autenticarse)
export JWT_ADMIN=""      # Se llena en el paso de autenticación
export JWT_ENTRENADOR="" # Se llena en el paso de autenticación
export CLIENTE_ID=""     # ID de un cliente existente en la BD
export CLASE_ID=""       # ID de una clase existente en la BD
```

---

## PASO 0 — AUTENTICACIÓN (obtener JWT tokens)

```bash
echo "=========================================="
echo "PASO 0: Autenticación — obtener JWT tokens"
echo "=========================================="

# Login como admin
echo "--- Login admin ---"
ADMIN_RESPONSE=$(curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{\"email\": \"$EMAIL_ADMIN\", \"password\": \"$PASSWORD_ADMIN\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password")

JWT_ADMIN=$(echo $ADMIN_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
export JWT_ADMIN
echo "JWT Admin: ${JWT_ADMIN:0:50}..."

# Login como entrenador
echo "--- Login entrenador ---"
ENTRENADOR_RESPONSE=$(curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{\"email\": \"$EMAIL_ENTRENADOR\", \"password\": \"$PASSWORD_ENTRENADOR\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password")

JWT_ENTRENADOR=$(echo $ENTRENADOR_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
export JWT_ENTRENADOR
echo "JWT Entrenador: ${JWT_ENTRENADOR:0:50}..."
```

---

## §3 — PRUEBAS DE API REST (Supabase REST API)
## (ISO/IEC 25010: Funcionalidad + Seguridad)

La "API REST" del sistema es la API auto-generada de Supabase en
`/rest/v1/`. Las pruebas validan los mismos requerimientos funcionales,
adaptadas al endpoint real.

```bash
echo "=========================================="
echo "§3 PRUEBAS DE API REST (Supabase REST API)"
echo "=========================================="

# ── §3.1: GET clientes CON token (RF1/RF13) ───────────────────────────────
echo ""
echo "--- TEST §3.1: GET /clientes con token (esperado: 200, < 500ms) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/alumnos?select=*&limit=10"

# ── §3.2: GET clientes SIN token ──────────────────────────────────────────
echo "--- TEST §3.2: GET /clientes sin token (esperado: 401, < 200ms) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/alumnos?select=*"

# ── §3.3: POST cliente datos válidos (RF1) ────────────────────────────────
echo "--- TEST §3.3: POST cliente válido (esperado: 201, < 800ms) ---"
curl -s -w "\nHTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "nombre": "Usuario Test IEEE829",
    "email": "test.ieee829@prueba.com",
    "celular": "3009998877",
    "patologia_principal": "Lumbalgia crónica",
    "clases_disponibles": 8
  }' \
  "$SUPABASE_URL/rest/v1/alumnos" | tail -3

# ── §3.4: POST con datos inválidos (campo obligatorio faltante) ───────────
echo "--- TEST §3.4: POST sin campos obligatorios (esperado: 400/422) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"email": "incompleto@test.com"}' \
  "$SUPABASE_URL/rest/v1/alumnos"

# ── §3.5: GET recurso inexistente (RF manejo de errores) ─────────────────
echo "--- TEST §3.5: GET ID inexistente (esperado: 200 array vacío o 404) ---"
curl -s -w "\nHTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/alumnos?id=eq.00000000-0000-0000-0000-000000000000&select=*" | tail -3

# ── §3.6: Control de acceso — entrenador no puede eliminar alumnos ────────
echo "--- TEST §3.6: DELETE sin permisos (token entrenador, esperado: 403) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -X DELETE \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ENTRENADOR" \
  "$SUPABASE_URL/rest/v1/alumnos?id=eq.$CLIENTE_ID"

# ── §3.7: GET clases disponibles (RF4) ────────────────────────────────────
echo "--- TEST §3.7: GET clases disponibles (esperado: 200) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/clases?select=*&activa=eq.true"

# ── §3.8: GET historial de asistencia de un alumno (RF7) ──────────────────
echo "--- TEST §3.8: GET asistencia por alumno (esperado: 200) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/reservas?id_alumno=eq.$CLIENTE_ID&select=*"

# ── §3.9: GET evaluaciones físicas — seguimiento (RF3) ────────────────────
echo "--- TEST §3.9: GET evaluaciones físicas (esperado: 200) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/evaluaciones_fisicas?id_alumno=eq.$CLIENTE_ID&select=*"

# ── §3.10: Edge Function create-entrenador ────────────────────────────────
echo "--- TEST §3.10: Edge Function create-entrenador (esperado: 200/201) ---"
curl -s -o /dev/null -w "HTTP: %{http_code} | Tiempo: %{time_total}s\n" \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Entrenador Test",
    "email": "entrenador.creado@test.com",
    "celular": "3001112233",
    "especialidad": "Pilates clínico"
  }' \
  "$SUPABASE_URL/functions/v1/create-entrenador"

echo ""
echo "✅ §3 PRUEBAS API REST COMPLETADAS"
```

---

## §4 — PRUEBAS DE RENDIMIENTO Y CARGA
## (ISO/IEC 25010: Rendimiento)
## Target: Supabase REST API + app estática en Hetzner

```bash
# Instalar k6 si no está disponible
sudo apt-get update -qq && sudo apt-get install -y gnupg curl
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update -qq && sudo apt-get install -y k6
```

### Escenario 1: Carga Normal — 20 usuarios, 5 minutos
```javascript
// Guardar como: test_s4_normal.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    errors: ['rate<0.01'],
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const JWT = __ENV.JWT;

export default function () {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${JWT}`,
    'Content-Type': 'application/json',
  };

  // Mix realista de operaciones del portal admin
  const responses = http.batch([
    ['GET', `${SUPABASE_URL}/rest/v1/alumnos?select=*&limit=20`, null, { headers }],
    ['GET', `${SUPABASE_URL}/rest/v1/clases?select=*&activa=eq.true`, null, { headers }],
    ['GET', `${SUPABASE_URL}/rest/v1/reservas?select=*&limit=10`, null, { headers }],
  ]);

  responses.forEach(r => {
    const ok = check(r, { 'status 200': (res) => res.status === 200 });
    errorRate.add(!ok);
  });

  sleep(1);
}
```

```bash
cat > test_s4_normal.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
let errorRate = new Rate('errors');
export let options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<800'], errors: ['rate<0.01'] },
};
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const JWT = __ENV.JWT;
export default function () {
  const headers = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${JWT}` };
  const r = http.get(`${SUPABASE_URL}/rest/v1/alumnos?select=*&limit=20`, { headers });
  const ok = check(r, { 'status 200': (res) => res.status === 200 });
  errorRate.add(!ok);
  sleep(1);
}
EOF

echo "=========================================="
echo "§4.1 CARGA NORMAL — 20 usuarios, 5 minutos"
echo "Umbral: p95 < 800ms, error < 1%"
echo "=========================================="
k6 run \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env ANON_KEY=$SUPABASE_ANON_KEY \
  --env JWT=$JWT_ADMIN \
  --summary-trend-stats="min,avg,med,p(90),p(95),p(99),max" \
  --out json=resultado_s4_normal.json \
  test_s4_normal.js
```

### Escenario 2: Carga Pico — 50 usuarios, 3 minutos
```bash
cat > test_s4_pico.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
let errorRate = new Rate('errors');
export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<1500'], errors: ['rate<0.02'] },
};
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const JWT = __ENV.JWT;
export default function () {
  const headers = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${JWT}` };
  const r = http.get(`${SUPABASE_URL}/rest/v1/alumnos?select=*&limit=20`, { headers });
  const ok = check(r, { 'status 200': (res) => res.status === 200 });
  errorRate.add(!ok);
  sleep(0.5);
}
EOF

echo "=========================================="
echo "§4.2 CARGA PICO — 50 usuarios, 3 minutos"
echo "Umbral: p95 < 1500ms, error < 2%"
echo "=========================================="
k6 run \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env ANON_KEY=$SUPABASE_ANON_KEY \
  --env JWT=$JWT_ADMIN \
  --summary-trend-stats="min,avg,med,p(90),p(95),p(99),max" \
  --out json=resultado_s4_pico.json \
  test_s4_pico.js
```

### Escenario 3: Carga Sostenida — 15 usuarios, 30 minutos
```bash
cat > test_s4_sostenida.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
let errorRate = new Rate('errors');
export let options = {
  stages: [
    { duration: '2m', target: 15 },
    { duration: '26m', target: 15 },
    { duration: '2m', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<800'], errors: ['rate<0.01'] },
};
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const JWT = __ENV.JWT;
export default function () {
  const headers = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${JWT}` };
  const r = http.get(`${SUPABASE_URL}/rest/v1/alumnos?select=*&limit=20`, { headers });
  const ok = check(r, { 'status 200': (res) => res.status === 200 });
  errorRate.add(!ok);
  sleep(2);
}
EOF

echo "=========================================="
echo "§4.3 CARGA SOSTENIDA — 15 usuarios, 30 min"
echo "Umbral: sin degradación progresiva"
echo "=========================================="
k6 run \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env ANON_KEY=$SUPABASE_ANON_KEY \
  --env JWT=$JWT_ADMIN \
  --summary-trend-stats="min,avg,med,p(90),p(95),p(99),max" \
  --out json=resultado_s4_sostenida.json \
  test_s4_sostenida.js
```

### Escenario adicional: Rendimiento de la app estática en Hetzner
```bash
echo "=========================================="
echo "§4.4 RENDIMIENTO APP ESTÁTICA — Hetzner VPS"
echo "Tiempo de carga de la SPA"
echo "=========================================="
for i in {1..10}; do
  curl -s -o /dev/null -w "Intento $i: %{time_total}s | HTTP %{http_code}\n" \
    "$APP_URL"
done
```

---

## §5 — PRUEBAS DE SEGURIDAD
## (ISO/IEC 25010: Seguridad — OWASP Top 10)

```bash
echo "=========================================="
echo "§5 PRUEBAS DE SEGURIDAD"
echo "=========================================="

# ── §5.1.1: Escaneo de puertos VPS Hetzner ────────────────────────────────
echo ""
echo "--- TEST §5.1.1: nmap — puertos VPS Hetzner (138.199.200.150) ---"
echo "Esperado: 22, 80, 443 abiertos. 5432 cerrado."
nmap -sV -p 22,80,443,3000,5432,8080,8443,9000 $VPS_IP
echo ""
echo "--- Escaneo top 100 puertos ---"
nmap --top-ports 100 $VPS_IP

# ── §5.1.2: SSL/TLS VPS ───────────────────────────────────────────────────
echo ""
echo "--- TEST §5.1.2: SSL/TLS en VPS ---"
curl -v --ssl-reqd "$APP_URL" 2>&1 | grep -E "SSL|TLS|cipher|subject|expire|issuer" || \
  echo "NOTA: Si el VPS usa IP sin dominio, el certificado SSL puede no estar configurado."

# ── §5.1.3: SSL/TLS Supabase ──────────────────────────────────────────────
echo ""
echo "--- TEST §5.1.3: SSL/TLS en Supabase ---"
curl -v --ssl-reqd "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>&1 | grep -E "SSL|TLS|cipher|subject"

# ── §5.2.1: Acceso sin autenticación (RLS de Supabase) ───────────────────
echo ""
echo "--- TEST §5.2.1: RLS — acceso sin token (esperado: 401 o array vacío) ---"
echo "Supabase devuelve 200 con array vacío si RLS está activo y no hay sesión."
RESULT=$(curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/alumnos?select=*")
echo "Respuesta: $RESULT"
echo "Verificar que sea [] (array vacío) y NO una lista de alumnos reales."

# ── §5.2.2: Inyección — caracteres especiales en query params ────────────
echo ""
echo "--- TEST §5.2.2: Inyección en parámetros de query ---"
echo "Esperado: 400 o respuesta vacía, sin error de BD expuesto."
curl -s -w "\nHTTP: %{http_code}\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/alumnos?nombre=eq.%27%20OR%201%3D1%20--&select=*" | tail -3

# ── §5.2.3: Token manipulado ──────────────────────────────────────────────
echo ""
echo "--- TEST §5.2.3: Token JWT manipulado (esperado: 401) ---"
curl -s -o /dev/null -w "HTTP: %{http_code}\n" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.PAYLOAD_MANIPULADO.FIRMA_INVALIDA" \
  "$SUPABASE_URL/rest/v1/alumnos?select=*"

# ── §5.2.4: Escalación de privilegios — RLS por rol ──────────────────────
echo ""
echo "--- TEST §5.2.4: Entrenador no puede acceder a pagos (esperado: 200 vacío o 403) ---"
RESULT=$(curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ENTRENADOR" \
  "$SUPABASE_URL/rest/v1/pagos?select=*")
echo "Respuesta con token entrenador: $RESULT"
echo "Verificar que sea [] o 403 — NO una lista de pagos."

# ── §5.2.5: Fuerza bruta en login (Supabase Auth) ─────────────────────────
echo ""
echo "--- TEST §5.2.5: Fuerza bruta login (esperado: rate limiting) ---"
for i in {1..15}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -d "{\"email\": \"$EMAIL_ADMIN\", \"password\": \"wrong_password_$i\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")
  echo "Intento $i: HTTP $CODE"
  sleep 0.5
done

# ── §5.2.6: OWASP ZAP contra el portal admin ─────────────────────────────
echo ""
echo "--- TEST §5.2.6: OWASP ZAP scan ---"
if command -v docker &> /dev/null; then
  docker run --rm -v $(pwd):/zap/wrk/:rw ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py \
    -t "$APP_URL" \
    -r reporte_zap.html \
    -l WARN
  echo "Reporte ZAP generado: reporte_zap.html"
else
  echo "Docker no disponible — ejecutar ZAP manualmente contra $APP_URL"
fi

# ── §5.2.7: Headers de seguridad HTTP ────────────────────────────────────
echo ""
echo "--- TEST §5.2.7: Headers de seguridad HTTP del VPS ---"
echo "Esperado: X-Frame-Options, X-Content-Type-Options, CSP presentes."
curl -s -I "$APP_URL" | grep -iE "x-frame|x-content|content-security|strict-transport|referrer"

echo ""
echo "✅ §5 PRUEBAS DE SEGURIDAD COMPLETADAS"
```

---

## §7 — PRUEBAS DE INTEGRACIÓN
## (ISO/IEC 25010: Compatibilidad)

```bash
echo "=========================================="
echo "§7 PRUEBAS DE INTEGRACIÓN"
echo "=========================================="

# ── §7.1: CRUD completo — crear alumno y verificar ────────────────────────
echo ""
echo "--- TEST §7.1: Crear alumno → verificar en BD ---"
CREATE_RESPONSE=$(curl -s \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "nombre": "Test Integracion IEEE829",
    "email": "integracion.test@prueba.com",
    "celular": "3001234567",
    "patologia_principal": "Test patologia",
    "clases_disponibles": 4
  }' \
  "$SUPABASE_URL/rest/v1/alumnos")

NEW_ID=$(echo $CREATE_RESPONSE | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if isinstance(data,list) and data else 'ERROR')" 2>/dev/null)
echo "Alumno creado con ID: $NEW_ID"

# Verificar que existe
echo "Verificando en BD..."
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/alumnos?id=eq.$NEW_ID&select=*" | python3 -m json.tool 2>/dev/null

# ── §7.2: Consistencia datos — tiempo de propagación ─────────────────────
echo ""
echo "--- TEST §7.2: Consistencia de datos (tiempo de propagación) ---"
START=$(date +%s%N)
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/alumnos?id=eq.$NEW_ID&select=id,nombre" > /dev/null
END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))
echo "Dato disponible en ${ELAPSED}ms (esperado: < 2000ms)"

# ── §7.3: Edge Function create-entrenador ─────────────────────────────────
echo ""
echo "--- TEST §7.3: Edge Function create-entrenador → verifica en auth + entrenadores ---"
EF_RESPONSE=$(curl -s \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Entrenador Test IEEE829",
    "email": "ef.test.ieee829@prueba.com",
    "celular": "3009876543",
    "especialidad": "Pilates reformer"
  }' \
  "$SUPABASE_URL/functions/v1/create-entrenador")
echo "Edge Function response: $EF_RESPONSE"

# Verificar que el entrenador quedó en la tabla
echo "Verificando entrenador en BD..."
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT_ADMIN" \
  "$SUPABASE_URL/rest/v1/entrenadores?email=eq.ef.test.ieee829@prueba.com&select=*" | python3 -m json.tool 2>/dev/null

# ── Limpiar datos de prueba ───────────────────────────────────────────────
echo ""
echo "--- Limpieza: eliminar datos de prueba creados ---"
if [ "$NEW_ID" != "ERROR" ] && [ ! -z "$NEW_ID" ]; then
  curl -s -o /dev/null -w "Eliminar alumno test: HTTP %{http_code}\n" \
    -X DELETE \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $JWT_ADMIN" \
    "$SUPABASE_URL/rest/v1/alumnos?id=eq.$NEW_ID"
fi

echo ""
echo "✅ §7 PRUEBAS DE INTEGRACIÓN COMPLETADAS"
```

---

## §8 — DISPONIBILIDAD
## (ISO/IEC 25010: Confiabilidad)

```bash
echo "=========================================="
echo "§8 DISPONIBILIDAD"
echo "=========================================="

# ── §8.1: Disponibilidad del VPS (app estática) ───────────────────────────
echo ""
echo "--- TEST §8.1: Disponibilidad VPS — 10 intentos ---"
PASS=0; FAIL=0
for i in {1..10}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$APP_URL")
  if [ "$CODE" = "200" ] || [ "$CODE" = "301" ] || [ "$CODE" = "302" ]; then
    echo "Intento $i: ✅ HTTP $CODE"
    ((PASS++))
  else
    echo "Intento $i: ❌ HTTP $CODE"
    ((FAIL++))
  fi
  sleep 5
done
echo "Resultado VPS: $PASS/10 exitosos"

# ── §8.2: Disponibilidad Supabase API ─────────────────────────────────────
echo ""
echo "--- TEST §8.2: Disponibilidad Supabase API — 10 intentos ---"
PASS=0; FAIL=0
for i in {1..10}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
    -H "apikey: $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/rest/v1/")
  if [ "$CODE" = "200" ]; then
    echo "Intento $i: ✅ HTTP $CODE"
    ((PASS++))
  else
    echo "Intento $i: ❌ HTTP $CODE"
    ((FAIL++))
  fi
  sleep 5
done
echo "Resultado Supabase: $PASS/10 exitosos"

echo ""
echo "NOTA: Las pruebas de reinicio del VPS (§8.2) deben ejecutarse"
echo "manualmente desde la consola de Hetzner."
```

---

## §10 — ANÁLISIS ESTÁTICO (TypeScript/React)
## Adaptado de Dart Analyzer a la arquitectura real

```bash
echo "=========================================="
echo "§10 ANÁLISIS ESTÁTICO — TypeScript/React"
echo "=========================================="

# Ejecutar desde la carpeta raíz del proyecto React
# cd [RUTA-PROYECTO-REACT]

echo "--- TypeScript type check ---"
npx tsc --noEmit 2>&1
echo "Criterio: 0 errores de tipo."

echo ""
echo "--- ESLint ---"
npx eslint src/ --ext .ts,.tsx 2>&1 | tail -20
echo "Criterio: 0 errores críticos (error level)."

echo ""
echo "--- Build de producción (verifica que compila) ---"
npm run build 2>&1 | tail -10
echo "Criterio: Build exitoso sin errores."

echo ""
echo "✅ §10 ANÁLISIS ESTÁTICO COMPLETADO"
```

---

## PRUEBAS QUE DEBEN EJECUTARSE MANUALMENTE

### §2 — Pruebas funcionales de la app móvil Flutter
No están en este repo. Requieren dispositivo Android físico:
- Registro de asistencia QR
- Agendamiento desde la app
- Visualización de gráficas de progreso
- Catálogo de ejercicios
- Flujo de pago Wompi (redirección)
- Notificaciones push FCM

### §6 — Encuestas de usabilidad y satisfacción
- Cuestionario SUS: aplicar a admin + 3 entrenadores
- Encuesta satisfacción: aplicar a 15 alumnos
- Instrumento: archivo `Encuestas_Validacion_MyCPilates.txt`

### §8 — Pruebas de disponibilidad con reinicio
- Reinicio VPS desde consola Hetzner
- Verificación de reconexión autossh del túnel SSH del admin

### §9 — Pruebas de compatibilidad
- Probar en dispositivos Android físicos (10, 12, 14)
- Verificar app admin en Chrome/Edge Windows del centro

---

## FORMATO DE REPORTE DE RESULTADOS

Al finalizar, reportar en estas tablas:

### §3 Pruebas de API (Supabase REST)
| Test | Endpoint | Esperado | Obtenido | Tiempo | Resultado |
|---|---|---|---|---|---|
| §3.1 | GET /alumnos (con token) | 200 | [ ] | [ ]ms | ✅/❌ |
| §3.2 | GET /alumnos (sin token) | 401/vacío | [ ] | [ ]ms | ✅/❌ |
| §3.3 | POST /alumnos (válido) | 201 | [ ] | [ ]ms | ✅/❌ |
| §3.4 | POST sin campos obligatorios | 400/422 | [ ] | [ ]ms | ✅/❌ |
| §3.5 | GET ID inexistente | 200 [] | [ ] | [ ]ms | ✅/❌ |
| §3.6 | DELETE sin permisos (entrenador) | 403/vacío | [ ] | [ ]ms | ✅/❌ |
| §3.7 | GET clases disponibles | 200 | [ ] | [ ]ms | ✅/❌ |
| §3.8 | GET asistencia por alumno | 200 | [ ] | [ ]ms | ✅/❌ |
| §3.9 | GET evaluaciones físicas | 200 | [ ] | [ ]ms | ✅/❌ |
| §3.10 | Edge Function create-entrenador | 200/201 | [ ] | [ ]ms | ✅/❌ |

### §4 Rendimiento (k6 → Supabase REST)
| Escenario | p95 | Error rate | Throughput | Resultado |
|---|---|---|---|---|
| §4.1 Carga normal (20u, 5min) | [ ]ms | [ ]% | [ ]req/s | ✅/❌ |
| §4.2 Carga pico (50u, 3min) | [ ]ms | [ ]% | [ ]req/s | ✅/❌ |
| §4.3 Carga sostenida (15u, 30min) | [ ]ms | [ ]% | [ ]req/s | ✅/❌ |
| §4.4 App estática Hetzner (10 req) | avg [ ]s | — | — | ✅/❌ |

### §5 Seguridad
| Test | Prueba | Resultado obtenido | Resultado |
|---|---|---|---|
| §5.1.1 | Puertos VPS (nmap) | Abiertos: [ ] | ✅/❌ |
| §5.1.2 | SSL/TLS VPS | TLS: [ ] | ✅/❌ |
| §5.1.3 | SSL/TLS Supabase | TLS: [ ] | ✅/❌ |
| §5.2.1 | RLS sin token | Respuesta: [ ] | ✅/❌ |
| §5.2.2 | Inyección query params | HTTP: [ ] | ✅/❌ |
| §5.2.3 | Token manipulado | HTTP: [ ] | ✅/❌ |
| §5.2.4 | Escalación privilegios entrenador | Respuesta: [ ] | ✅/❌ |
| §5.2.5 | Fuerza bruta login | Rate limit en intento #[ ] | ✅/❌ |
| §5.2.6 | OWASP ZAP | Vuln. críticas: [ ] | ✅/❌ |
| §5.2.7 | Headers de seguridad HTTP | Headers presentes: [ ] | ✅/❌ |

### §7 Integración
| Test | Escenario | Resultado | ✅/❌ |
|---|---|---|---|
| §7.1 | CRUD alumno → verificar en BD | ID creado: [ ] | ✅/❌ |
| §7.2 | Tiempo de propagación datos | [ ]ms | ✅/❌ |
| §7.3 | Edge Function create-entrenador | Entrenador en BD: [ ] | ✅/❌ |

### §8 Disponibilidad
| Componente | Intentos exitosos | Resultado |
|---|---|---|
| VPS Hetzner (app estática) | [ ]/10 | ✅/❌ |
| Supabase REST API | [ ]/10 | ✅/❌ |

### §10 Análisis estático
| Herramienta | Errores | Warnings | Resultado |
|---|---|---|---|
| TypeScript (tsc --noEmit) | [ ] | [ ] | ✅/❌ |
| ESLint | [ ] | [ ] | ✅/❌ |
| Build producción | Exitoso/Fallido | — | ✅/❌ |
