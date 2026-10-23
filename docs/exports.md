# Contrato de exportación

«Exportable» significa un archivo entregado al usuario, no una función exportada de TypeScript.

1. Nombre base con mayúscula inicial: FlowSaldo-2026-10.csv, Reporte.xlsx.
2. Encabezados distintos, con mayúscula inicial y sin separadores incrustados: Fecha, Tipo, Moneda, Monto, Descripción, Categoría.
3. Al menos dos columnas, una celda por campo y filas de ancho consistente. Los importes y monedas permanecen separados.
4. CSV usa comas, comillas para texto y escape de saltos de línea/comillas. Neutralizar fórmulas en texto no confiable.
5. Excel .xlsx: primera fila con encabezados, cada dato en su columna, sin celdas combinadas. Cada hoja debe ser tabular. No se acepta guardar «Fecha,Monto» en una celda. Los .xls antiguos deben convertirse antes de validarlos.

La app valida nombre y esquema antes de descargar CSV en web. Android comparte texto CSV con título FlowSaldo; no genera aún un archivo adjunto. La preferencia de ocultar importes no elimina valores del archivo exportado.

El guardián CLI inspecciona archivos reales:

```powershell
pnpm exports:check FlowSaldo-2026-10.csv Reporte.xlsx
pnpm exports:test
```

Para otros formatos verifica nombre y existencia, sin analizar contenido. El guardián no comprueba fidelidad financiera contra una fuente externa. El perfil export-guardian revisa esa correspondencia. .xlsx está soportado por el validador de desarrollo; la app no incluye exportación Excel todavía.
