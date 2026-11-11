# Instrucciones del área

Se aplican además de AGENTS.md raíz.

Mantener autorización en todas las rutas salvo health, preflight y las rutas públicas acotadas /auth/status, /auth/login, /auth/recover y /auth/setup (esta última exige el token inicial). Zod valida inputs y límites monetarios. CORS restringido no sustituye autenticación. Revisar docs/api.md y actualizarlo. Probar errores, CRUD, filtros y resolución concurrente cuando cambien.

Una sola AppOwner por instalación. Al configurarla, DEV_API_TOKEN deja de autorizar datos. No agregar registro multiusuario, bypass de sesión o persistencia de contraseñas/tokens en claro. Probar revocación, expiración y límite de intentos ante cambios de acceso.

## Arquitectura MVC

Coloca rutas y validación HTTP en `src/controllers`. Usa el esquema Prisma como modelo y coloca las operaciones de datos reutilizables, las transacciones y las reglas de persistencia en `src/models`. Las vistas de esta API son respuestas JSON y las representaciones compartidas viven en `src/views`. Mantén `src/index.ts` dedicado a configuración, middleware y montaje. Los modelos no importan Express.
