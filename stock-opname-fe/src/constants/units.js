export const BASE_UOM_OPTIONS = [
  { value: 'kg', label: 'kg (Kilogram)' },
  { value: 'pcs', label: 'pcs (Pieces)' },
  { value: 'lusin', label: 'lusin (12 pcs)' },
  { value: 'pack', label: 'pack (Kemasan)' },
  { value: 'box', label: 'box (Kotak)' },
  { value: 'liter', label: 'liter (Liter)' },
  { value: 'botol', label: 'botol (Botol)' },
  { value: 'butir', label: 'butir (Butir)' },
]

export const SKU_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'AKTIF', label: 'AKTIF' },
  { value: 'NONAKTIF', label: 'NONAKTIF' },
]

export function formatFactor(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return String(value ?? '')
  if (Number.isInteger(parsed)) return String(parsed)
  return String(parsed)
}
