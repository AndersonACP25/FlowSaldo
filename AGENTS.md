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
