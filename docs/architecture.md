# Arquitectura inicial

Monorepo npm workspaces. Una API y un worker comparten dominio y acceso PostgreSQL. TypeScript se ejecuta mediante tsx en desarrollo; la app usa Metro. Los paquetes internos exportan fuente para evitar compilación previa.

```mermaid
flowchart TD
  A["Importación sintética por API"] --> B["MailImport PENDING"]
  B --> C["Worker y parser demo-v1"]
  C --> D{"¿Válido?"}
  D -->|Sí| E["Movement"]
  D -->|No| F["REVIEW"]
  E --> G["API Express"]
  G --> H["App Android"]
```

## Decisiones

- Dinero en centavos enteros, moneda obligatoria, sin conversiones implícitas.
- Transferencias propias no participan en ingresos y gastos. Todavía no se modelan cuentas, deuda, devoluciones ni conciliación.
- externalId único evita reimportar el mismo mensaje. No deduplica mensajes distintos sobre una misma operación: esa capacidad está pendiente.
- SELECT FOR UPDATE SKIP LOCKED mantiene un mensaje bloqueado mientras se procesa. Crear movimiento y actualizar importación ocurre en una sola transacción; un fallo revierte ambas acciones. importId único añade protección.
- Errores transitorios reintentan cada dos segundos. No hay contador/backoff ni dead-letter: implementar antes del piloto real.
- API de desarrollo para una sola persona con token compartido. No hay usuarios ni aislamiento multiusuario. Health es público; los demás endpoints exigen Bearer.
- La app limita la lista remota a 200 registros e identifica ese alcance. El endpoint summary usa todos los registros; no tiene filtros mensuales todavía.
- No se almacena token en disco ni en EXPO_PUBLIC_*. La sesión del móvil vive en memoria.

## Próxima arquitectura de correo

OAuth -> conector Gmail/Graph -> jobs persistidos -> parser versionado por banco -> validación/revisión -> movimientos -> API -> app. Definir identidad de usuario, permisos mínimos, cifrado de tokens, retención, consentimiento y revocación antes de incorporar información real. No almacenar contraseñas bancarias.
