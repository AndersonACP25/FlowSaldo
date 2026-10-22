# Próximas fases

## Completado en v0.2

Demo persistente; CRUD manual local y API; filtros por mes, moneda, tipo y texto; presupuesto local; gastos por categoría; CSV web y compartir texto nativo; scripts web/Expo Go; MEMORY.md. Pruebas de dominio, Playwright y CI PostgreSQL.

## Pendiente

1. Validar en Android físico y generar APK preview. Añadir pruebas Appium y accesibilidad nativa.
2. Añadir usuarios, sesiones, HTTPS, almacenamiento seguro de tokens, revocación, retención y eliminación.
3. Seleccionar Gmail u Outlook y un banco; recopilar muestras anonimizadas. Resolver requisitos de OAuth antes de conectar datos reales.
4. Implementar conector incremental, cursores, reintentos con backoff y parsers versionados. Deduplicar avisos distintos de una misma operación.
5. Añadir cuentas, tarjetas/deuda, conciliación, correcciones de REVIEW y paginación completa; sincronizar presupuestos por usuario.
6. Añadir exportación de archivo CSV nativo y pruebas del piloto personal.

IA opcional después de validar parsers deterministas. Ningún dato de correo debe ejecutar instrucciones ni acciones. Casos inciertos pasan por revisión humana.
