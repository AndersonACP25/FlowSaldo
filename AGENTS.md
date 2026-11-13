# FlowSaldo

- Escribir los mensajes de commit en español, incluido el cuerpo cuando se use. Los prefijos convencionales como `fix:` y `docs:` pueden conservarse.

- Ejecutar desde raíz: pnpm install --frozen-lockfile, pnpm db:generate, pnpm check.
- Mantener datos de prueba sintéticos. Nunca añadir tokens, correos reales ni credenciales.
- Dinero en amountMinor entero y moneda explícita. Excluir transferencias propias de ingresos y gastos.
- Alcance de importación: bancos de República Dominicana y PayPal. Parser desconocido o ambiguo -> REVIEW. No inferir monto, moneda ni fecha. Usar muestras anonimizadas y no tratar el texto pegado como prueba del remitente.
- Mantener transacciones e idempotencia del worker.
- Actualizar docs/api.md ante cambios de contrato y README ante cambios de arranque.
- Mantener una cuenta personal por instalación; no desplegar como aplicación multiusuario. Tras configurar AppOwner, el token inicial deja de autorizar datos.
- Leer MEMORY.md al retomar y actualizarlo ante cambios de alcance o decisiones. No almacenar secretos ni datos personales.
- Comandos de interfaz desde raíz: pnpm start (Expo Go), pnpm web (PC), pnpm android (emulador).
- Backend MVC: controladores HTTP en apps/api/src/controllers, modelos Prisma y operaciones de datos en apps/api/src/models, respuestas JSON en apps/api/src/views. index.ts configura y monta la aplicación.
- Leer DESIGN.md antes de modificar interfaz; usar sus tokens y cuatro accesos de navegación.
- Ante cambios del arranque web ejecutar pnpm test:dev además de exportar: un bundle de producción no cubre Metro dev.

## Coordinación IA

Leer ai/README.md y ai/policies.md al usar agentes. El catálogo está en ai/manifest.json; entrada orchestrator. Los AGENTS.md anidados agregan instrucciones por área. Los perfiles y entregas no sustituyen permisos del host ni evidencia de ejecución. No delegar recursivamente. Conservar un responsable por archivo. Consultar TESTING.md y SECURITY.md.

Comandos: pnpm ai:validate, pnpm ai:test y pnpm ai:plan --task "Objetivo" --scope frontend. Para cambios de contratos o instrucciones actualizar catálogo, documentación y pruebas en el mismo PR.

- Revisar LANGUAGE.md y usar concordancia 0/1/N. El revisor lingüístico es language-editor.
- Archivos exportados: nombre y encabezados con mayúscula inicial; Cada campo de un archivo tabular ocupa su propia columna y cada registro su propia fila. En CSV y Excel, separar monto, moneda y los demás campos, sin celdas combinadas ni listas de campos en una celda. Consultar docs/exports.md y export-guardian.
- Gestor único: la versión de pnpm declarada en packageManager, con pnpm-lock.yaml y pnpm-workspace.yaml. No generar package-lock.json.


## Alcance de pruebas (regla permanente)

- Unitarias de producto: solo reglas CORE con riesgo de pérdida de datos o importes incorrectos (precisión, monedas, parser, categorías/historia, presupuestos, recurrencias e idempotencia, comparativas y CSV). Mantener casos agrupados en packages/domain/test/core.test.ts.
- Playwright: pocos recorridos críticos independientes (registro/persistencia/exportación, confirmación de recurrencia/revisión con trazabilidad, exportación API completa). No recorrer cada pantalla, preferencia, etiqueta, filtro o CRUD secundario por defecto.
- No añadir una prueba por cada helper/componente ni duplicar en UI las combinaciones ya cubiertas por dominio o API. Añadir una prueba solo si cubre un riesgo CORE nuevo o una regresión concreta; indicar ese riesgo en el PR. La autenticación justifica un recorrido crítico adicional de acceso/cierre sin una matriz completa de pantallas.
- Reglas transaccionales, autorización, migraciones y concurrencia se verifican en integración API/PostgreSQL. Mantener el smoke de arranque Metro separado de la regresión de producto.
- Elegir comprobaciones según archivos y riesgos afectados. Las instrucciones de pruebas generales no obligan a ampliar la cobertura de todo el sistema.
