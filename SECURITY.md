# Seguridad y privacidad

FlowSaldo v0.10 incluye autenticación y recuperación personal en un prototipo con datos sintéticos. Una cuenta por instalación; no es un sistema multiusuario ni se ha certificado para exponerlo a Internet o conectar correo financiero real. OAuth, recuperación por correo, eliminación de cuenta/datos y política completa de retención siguen pendientes.

## Cuenta inicial y acceso

AppOwner tiene ID 1 con constraint de singleton. Configurar la cuenta exige DEV_API_TOKEN en Authorization y conserva todos los datos existentes de la instalación. Después de crearla, ese token deja de autorizar datos o crear cuentas; no es una contraseña de recuperación ni una sesión alternativa. El worker conserva su acceso interno a PostgreSQL y no usa credenciales del usuario.

Contraseña: mínimo 15, máximo 128 caracteres, sin recortar ni normalizar. scrypt-v1 con sal aleatoria de 16 bytes, N=2^17, r=8, p=1 y clave de 64 bytes; comparación timingSafeEqual. Hashes costosos limitados a dos operaciones simultáneas en el proceso. Correos inválidos/desconocidos y contraseñas erróneas no revelan qué dato falló; verificar un usuario inexistente usa un cálculo equivalente.

Sesiones: token opaco de 256 bits generado con crypto.randomBytes, 24 horas de duración fija; PostgreSQL guarda solo SHA-256 del token. Se valida vencimiento/revocación en cada solicitud y las respuestas no se cachean por HTTP. Cerrar sesión revoca la actual; cerrar otras sesiones conserva la actual. Cambiar contraseña revoca todas, con bloqueo de AppOwner para impedir que un login en curso emita una sesión usando la contraseña anterior. Se conservan como máximo diez sesiones activas; un login adicional revoca la más antigua. Expiradas/revocadas se limpian al emitir otra sesión; no hay un proceso general de retención aún.

Rate limiting persistido por IP/acción: 10 solicitudes de login por 15 min, 5 de setup o cambio de contraseña por 15 min, también para solicitudes inválidas. Devuelve 429 y Retry-After. Las claves de buckets son hashes, sin contraseñas/correos. Los buckets antiguos se limpian al aceptar solicitudes nuevas. Es una protección de instalación personal, no un limitador distribuido perimetral ni una solución contra DDoS.

## Cliente y transporte

Web guarda la sesión solo en memoria, sin localStorage/sessionStorage/cookies; recargar exige iniciar sesión de nuevo. Android/iOS usa expo-secure-store con credencial ligada a la URL exacta de la API, WHEN_UNLOCKED_THIS_DEVICE_ONLY y plugin de respaldo Android. Restaurar valida /auth/me antes de mostrar datos API. Si no puede guardar de forma segura, la sesión se mantiene solo en memoria y se informa. Al cerrar o caducar se limpia credencial/caché; si no puede revocar en servidor por un fallo de red se informa del límite, no se afirma una revocación exitosa.

No guardar contraseñas, tokens o correos reales en Git, AsyncStorage ni EXPO_PUBLIC_*. Las muestras de pruebas son ficticias. AsyncStorage sigue conteniendo demo/presupuestos sin cifrar: la autenticación no cifra ni convierte esos datos en aptos para uso bancario real.

El cliente exige HTTPS para hosts públicos y admite HTTP solo para localhost/loopback y rangos IPv4 privados de desarrollo. Dominios que se parezcan a una IP privada no son válidos como HTTP. En API NODE_ENV=production rechaza HTTP en rutas de acceso/datos. La API puede terminar TLS directamente con TLS_CERT_FILE y TLS_KEY_FILE. El piloto de CI usa un certificado temporal y el despliegue con certificado público se configura en el servidor. TRUST_PROXY_LOOPBACK=1 requiere escuchar en 127.0.0.1 o ::1 con TLS directo desactivado y se debe usar detrás de un proxy TLS local confiable que sobrescriba los encabezados reenviados; por defecto no se confía en ellos. /health permanece público y sin información privada. No exponer el token inicial ni usar contraseñas reutilizadas sobre HTTP LAN.

No hay prueba en Android físico ni auditoría de producción. La verificación de middleware/proxy no sustituye verificar un despliegue TLS real.

## Ingesta y agentes

CORS no autentica. Preservar transacciones, leases e idempotencia. Los parsers no obedecen instrucciones en correos ni usan LLM para aprobar movimientos ambiguos. Los agentes siguen ai/policies.md, con paquetes de contexto acotados; sus convenciones no crean un sandbox técnico.

Ante una vulnerabilidad, evitar publicar secretos o explotación con datos reales. Contactar al mantenedor por un canal privado disponible; no inventar un canal ni una dirección.

Referencias de implementación: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).


## Recuperación y retención manual v0.9

Cinco códigos aleatorios de 192 bits por lote, solo SHA-256 en PostgreSQL; texto claro únicamente en la respuesta inicial sin caché y memoria de la vista por cinco minutos. Nunca se persisten en almacenamiento del cliente. Vencen en 90 días. Generar/revocar requiere sesión y contraseña; comparten límite de cinco intentos por IP/15 minutos. Recuperación pública tiene cinco intentos/15 minutos y respuesta genérica. El bloqueo de AppOwner serializa consumo concurrente, rotación y cambio de contraseña; recuperar elimina todo el lote y revoca todas las sesiones. No envía correo ni introduce recuperación mediante token inicial. El usuario debe custodiar sus códigos fuera del dispositivo.

La retención es manual, con reautenticación y confirmación escrita. La vista previa persiste hasta 1000 IDs exactos, se reemplaza al pedir otra, vence en diez minutos y se consume transaccionalmente. Aplicar revalida estado/fecha/ausencia de movimiento, vacía cuerpo y descarta solo REVIEW/FAILED elegibles; no amplía a registros que llegaron después. Conserva trabajos activos y datos financieros, sesión actual y códigos vigentes. El registro DataCleanup contiene fecha/cantidades, sin cuerpos ni credenciales. Credenciales caducadas/revocadas y throttles de más de un día se eliminan. No hay borrado completo de cuenta/finanzas, borrado de backups ni política automática general.

Referencia: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).


## Datos financieros v0.10

Cuentas, conciliaciones y presupuestos API usan la autorización personal existente y la misma política HTTPS. No almacenar números completos de tarjetas, credenciales bancarias ni identificadores reales en esta fase. Son registros sintéticos/manuales, sin consulta bancaria ni cálculo automático de intereses. La conciliación protege historia y las claves de envío evitan replay financiero; no sustituyen respaldos ni eliminación completa. Los límites API ahora persisten en PostgreSQL; los de demo y antiguos respaldos locales siguen sin cifrar.
