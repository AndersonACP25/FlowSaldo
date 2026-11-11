# Mantenimiento de datos

El worker puede limpiar hasta 1 000 avisos por ciclo, al arrancar y cada hora. Configura `AUTO_RETENTION_DAYS` entre 7 y 365 para activarlo. El valor 0 lo desactiva. Solo limpia el cuerpo de avisos en revisión o con error sin movimiento vinculado. Conserva sus identificadores, registra las cantidades y deja los avisos como descartados.

Los comandos de mantenimiento requieren `psql`, `pg_dump` y `pg_restore` compatibles con el servidor en el PATH. Usa una ruta fuera del repositorio y conserva juntos el archivo y su suma SHA-256.

```sh
pnpm data:admin backup /ruta/FlowSaldo.dump
```

El respaldo incluye los datos financieros y el hash de contraseña. Custódialo como dato privado. Las sesiones, los códigos de recuperación, los límites de acceso y las vistas previas quedan excluidos. La suma detecta daños accidentales. Restaura exclusivamente archivos de procedencia confiable.

Para verificar una restauración, crea una base PostgreSQL vacía, apunta `DATABASE_URL` a ella y ejecuta `pnpm data:admin restore /ruta/FlowSaldo.dump`. Comprueba la cuenta, los saldos y los movimientos en esa instalación aislada antes de usarla. El comando compara la suma y restaura dentro de una transacción. Después inicia una sesión nueva.

Para eliminar la cuenta y todos los datos de la instalación, detén API, worker y otros clientes. Comprueba la conexión, sustituye el ejemplo por el nombre exacto de la base y ejecuta:

```sh
pnpm data:admin erase nombre_exacto_de_la_base
```

La operación reinicia la cuenta y el catálogo inicial de categorías. Los archivos de respaldo, las copias externas y el almacenamiento local del dispositivo se gestionan por separado. Antes de reiniciar los servicios, verifica el token de configuración inicial.
