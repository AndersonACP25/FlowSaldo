# FlowSaldo

- Ejecutar desde raíz: npm ci, npm run db:generate, npm run check.
- Mantener datos de prueba sintéticos. Nunca añadir tokens, correos reales ni credenciales.
- Dinero en amountMinor entero y moneda explícita. Excluir transferencias propias de ingresos y gastos.
- Parser desconocido -> REVIEW. No inferir monto, moneda ni fecha.
- Mantener transacciones e idempotencia del worker.
- Actualizar docs/api.md ante cambios de contrato y README ante cambios de arranque.
- No desplegar este prototipo de token compartido como aplicación multiusuario.
- Leer MEMORY.md al retomar y actualizarlo ante cambios de alcance o decisiones. No almacenar secretos ni datos personales.
- Comandos de interfaz desde raíz: npm start (Expo Go), npm run web (PC), npm run android (emulador).
- Leer DESIGN.md antes de modificar interfaz; usar sus tokens y cuatro accesos de navegación.
- Ante cambios del arranque web ejecutar npm run test:dev además de exportar: un bundle de producción no cubre Metro dev.

## Coordinación IA

Leer ai/README.md y ai/policies.md al usar agentes. El catálogo está en ai/manifest.json; entrada orchestrator. Los AGENTS.md anidados agregan instrucciones por área. Los perfiles y entregas no sustituyen permisos del host ni evidencia de ejecución. No delegar recursivamente. Conservar un responsable por archivo. Consultar TESTING.md y SECURITY.md.

Comandos: npm run ai:validate, npm run ai:test y npm run ai:plan -- --task "Objetivo" --scope frontend. Para cambios de contratos o instrucciones actualizar catálogo, documentación y pruebas en el mismo PR.
