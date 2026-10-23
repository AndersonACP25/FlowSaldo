# FlowSaldo

- Ejecutar desde raíz: pnpm install --frozen-lockfile, pnpm db:generate, pnpm check.
- Mantener datos de prueba sintéticos. Nunca añadir tokens, correos reales ni credenciales.
- Dinero en amountMinor entero y moneda explícita. Excluir transferencias propias de ingresos y gastos.
- Parser desconocido -> REVIEW. No inferir monto, moneda ni fecha.
- Mantener transacciones e idempotencia del worker.
- Actualizar docs/api.md ante cambios de contrato y README ante cambios de arranque.
- No desplegar este prototipo de token compartido como aplicación multiusuario.
- Leer MEMORY.md al retomar y actualizarlo ante cambios de alcance o decisiones. No almacenar secretos ni datos personales.
- Comandos de interfaz desde raíz: pnpm start (Expo Go), pnpm web (PC), pnpm android (emulador).
- Leer DESIGN.md antes de modificar interfaz; usar sus tokens y cuatro accesos de navegación.
- Ante cambios del arranque web ejecutar pnpm test:dev además de exportar: un bundle de producción no cubre Metro dev.

## Coordinación IA

Leer ai/README.md y ai/policies.md al usar agentes. El catálogo está en ai/manifest.json; entrada orchestrator. Los AGENTS.md anidados agregan instrucciones por área. Los perfiles y entregas no sustituyen permisos del host ni evidencia de ejecución. No delegar recursivamente. Conservar un responsable por archivo. Consultar TESTING.md y SECURITY.md.

Comandos: pnpm ai:validate, pnpm ai:test y pnpm ai:plan --task "Objetivo" --scope frontend. Para cambios de contratos o instrucciones actualizar catálogo, documentación y pruebas en el mismo PR.

- Revisar LANGUAGE.md y usar concordancia 0/1/N. El revisor lingüístico es language-editor.
- Archivos exportados: nombre y encabezados con mayúscula inicial; CSV/Excel deben separar campos en columnas. Consultar docs/exports.md y export-guardian.
- Gestor único: pnpm 10.34.7, con pnpm-lock.yaml y pnpm-workspace.yaml. No generar package-lock.json.
