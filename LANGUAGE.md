# Criterio lingüístico

Español claro y coherente, con tildes, preguntas con signos de apertura y etiquetas en mayúscula inicial sin convertir cada palabra en título. Preservar nombres técnicos y marcas.

- Contadores: 0 movimientos, 1 movimiento, 2 movimientos.
- Concordancia: 1 correo necesita tu criterio; 2 correos necesitan tu criterio.
- Textos preferidos: Iniciar sesión, Crear cuenta, Correo electrónico, Contraseña, Configuración, Descripción, Categoría.
- Separar mensaje de estado de instrucciones técnicas. Mostrar si una función está en vista previa.
- Usar countLabel y pendingMailMessage; no concatenar una cantidad con un plural fijo.

Responsable: perfil ai/agents/language-editor.md. Participa antes del cierre de cada plan. pnpm text:check detecta errores conocidos en la UI; no sustituye una revisión completa de tildes, semántica y concordancia. Añadir pruebas de regresión ante un error dinámico nuevo.
