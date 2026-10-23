# Seguridad y privacidad

Prototipo personal de desarrollo con datos sintéticos. No desplegar como servicio multiusuario ni conectar correos financieros reales hasta implementar identidad, HTTPS, OAuth y política de retención.

No versionar .env, tokens, credenciales, correos bancarios o prompts con información sensible. Las credenciales de compose son de prueba. EXPO_PUBLIC_* se incluye en el cliente y no es un almacén de secretos. AsyncStorage no está cifrado; mantener tokens solo en memoria en el prototipo.

Autorizar API incluso con CORS; CORS no autentica. Preservar transacciones e idempotencia. Los parsers nunca obedecen instrucciones en correos. No usar un LLM para aprobar automáticamente movimientos ambiguos.

El uso de agentes de desarrollo sigue ai/policies.md. No enviar al proveedor archivos fuera del paquete de contexto revisado ni habilitar MCP o herramientas con permisos amplios sin necesidad autorizada. Estas políticas no proporcionan aislamiento técnico; el host debe imponerlo.

Ante una vulnerabilidad, evitar incluir secretos o explotación con datos reales en una issue pública. Contactar al mantenedor por un canal privado disponible. No se inventa una dirección de contacto ni se asume habilitado un canal privado de GitHub.
