# Plan de feature · Importación de avisos bancarios con Gmail

## Objetivo

Permitir que el titular de FlowSaldo conecte Gmail a su instalación, importe los avisos de retiro admitidos de BHD y Popular y revise los datos sugeridos antes de registrar un movimiento.

## Punto de partida

FlowSaldo reconoce retiros aprobados en DOP de BHD y Popular cuando se pegan como texto sintético. La cola, la revisión manual y el vínculo al movimiento confirmado ya existen. Este plan los reutiliza para el piloto de Gmail.

## Entregas

| Entrega                | Alcance                                                                                                                                                                       | Criterio de aceptación                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Conectar Gmail      | Autorizar desde la cuenta personal, guardar credenciales del proveedor en el servidor y permitir desconectar.                                                                 | La app indica el estado de la conexión. Al desconectar, deja de consultar Gmail y retira las credenciales de la instalación.               |
| 2. Importar avisos     | Buscar avisos candidatos, leer solo los mensajes necesarios y enviarlos a la cola existente. Guardar el punto de sincronización y deduplicar por identificador del proveedor. | Dos sincronizaciones y un reinicio dejan una sola importación por mensaje. Los errores temporales permiten reintentar sin perder mensajes. |
| 3. Revisar y confirmar | Reutilizar los parsers de retiros. Mostrar monto, moneda, fecha y cajero. Permitir corregir, descartar o registrar como gasto o transferencia a efectivo.                     | La importación queda en Por revisar. Los totales cambian solo cuando el titular confirma la operación.                                     |
| 4. Validar el piloto   | Probar en web y Android con un buzón de prueba, un despliegue HTTPS y muestras anonimizadas.                                                                                  | Se completa conexión → importación → confirmación → desconexión en los dos clientes.                                                       |

## Primer corte para implementar

1. Documentar la configuración del proyecto OAuth de prueba y su URL de retorno. Mostrar el estado **Desconectado**, **Conectado** o **Requiere autorización** en Configuración.
2. Implementar la conexión y la desconexión con un proveedor simulado. Verificar que solo la cuenta personal pueda iniciarlas y que un retorno OAuth vencido o repetido se rechace.
3. Añadir **Sincronizar ahora** con una ventana inicial de siete días como valor propuesto. Mostrar cuántos avisos quedaron en revisión y cuándo ocurrió la última sincronización exitosa.
4. Ensayar con avisos anonimizados. Validar que un retiro ambiguo permita corrección manual y que volver a sincronizar mantenga los saldos y el número de importaciones.

El piloto empieza con un buzón y sincronización manual. La sincronización programada y la ampliación a más formatos se evalúan después de comprobar este recorrido.

## Dependencias y alcance posterior

- Preparar un proyecto OAuth de Google para el piloto, un buzón de prueba y una URL HTTPS para el retorno de la autorización. Confirmar con la documentación vigente de Google los permisos y requisitos de verificación antes de implementar el conector.
- Mantener la primera entrega bancaria centrada en retiros de BHD y Popular. Compras, transferencias recibidas de Banreservas y pagos de PayPal requieren muestras anonimizadas y parsers propios.
- Usar datos sintéticos en CI. Cubrir deduplicación, reintentos, desconexión y confirmación mediante pruebas de integración. Validar la autorización real con el buzón del piloto.
