# Instrucciones del área

Se aplican además de AGENTS.md raíz.

Leer DESIGN.md. Mantener Expo Android y web, accesibilidad, tokens y navegación de cuatro secciones. No añadir UI de IA/conectividad activa si no existe backend. Probar test:web; cambios de arranque también test:dev. No guardar tokens en AsyncStorage ni EXPO_PUBLIC_*.

Sesión personal: web solo en memoria; Android/iOS mediante SecureStore, ligada a la URL de la API y validada antes de restaurar. Limpiar caché y credencial al cerrar/revocar o expirar. Nunca permitir HTTP público para credenciales.
