export function csvTextCell(value: string) {
  return '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
}

export function validateExportName(name: string): void {
  if (!/^\p{Lu}/u.test(name) || /[\\/:]/.test(name) || name.includes('..'))
    throw new Error('El nombre del archivo debe comenzar con mayúscula y no contener rutas');
}
export function validateExportTable(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  if (
    headers.length < 2 ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !/^\p{Lu}/u.test(h.trim()) || /[,;\t\r\n]/.test(h))
  )
    throw new Error(
      'Los encabezados deben ser distintos, comenzar con mayúscula y ocupar columnas separadas',
    );
  if (
    rows.some(
      (row) =>
        row.length !== headers.length ||
        row.filter((value) => value !== null && value !== undefined && value !== '').length < 2,
    )
  )
    throw new Error('Cada fila debe tener una celda por columna');
}
