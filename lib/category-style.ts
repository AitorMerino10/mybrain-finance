import { normalizeName } from '@/lib/recurring'

export type CategoryStyle = { emoji: string; color: string }

/** Emoji por palabra clave del nombre de la vertical (se busca la primera que coincida). */
const EMOJI_RULES: Array<{ words: string[]; emoji: string }> = [
  { words: ['restaur', 'bar', 'cena', 'comida fuera', 'cafe', 'cafeteria', 'tapas', 'brunch'], emoji: '🍽️' },
  { words: ['super', 'compra', 'alimenta', 'comida', 'mercado', 'frutas'], emoji: '🛒' },
  { words: ['transporte', 'gasolina', 'combustible', 'coche', 'auto', 'parking', 'taxi', 'metro', 'tren', 'bus', 'peaje', 'moto'], emoji: '🚗' },
  { words: ['viaje', 'vacaciones', 'hotel', 'vuelo', 'avion', 'escapada'], emoji: '✈️' },
  { words: ['ocio', 'entreten', 'cine', 'teatro', 'concierto', 'fiesta', 'plan', 'salir', 'juego', 'copas'], emoji: '🎉' },
  { words: ['salud', 'medic', 'farmacia', 'dentista', 'doctor', 'clinica', 'fisio', 'psico', 'optica'], emoji: '💊' },
  { words: ['deporte', 'gimnasio', 'gym', 'fitness', 'padel', 'futbol'], emoji: '🏋️' },
  { words: ['hogar', 'casa', 'alquiler', 'hipoteca', 'vivienda', 'comunidad', 'mueble', 'reforma', 'luz', 'agua', 'gas', 'internet', 'telefon', 'suministro'], emoji: '🏠' },
  { words: ['ropa', 'moda', 'zapato', 'calzado', 'complemento', 'belleza', 'peluquer', 'estetica'], emoji: '👕' },
  { words: ['regalo', 'cumple', 'boda'], emoji: '🎁' },
  { words: ['educa', 'curso', 'formacion', 'libro', 'colegio', 'universidad', 'estudio'], emoji: '📚' },
  { words: ['suscrip', 'streaming', 'netflix', 'spotify', 'software', 'app', 'tecnolog', 'movil', 'electronic'], emoji: '📱' },
  { words: ['mascota', 'perro', 'gato', 'veterin'], emoji: '🐶' },
  { words: ['hijo', 'bebe', 'nino', 'guarderia', 'familia'], emoji: '👶' },
  { words: ['seguro', 'impuesto', 'banco', 'comision', 'gestor', 'hacienda'], emoji: '🧾' },
  { words: ['ahorro', 'inversion', 'fondo'], emoji: '🐖' },
  { words: ['donacion', 'ong', 'caridad'], emoji: '💝' },
]

/** Paleta pensada para distinguirse bien sobre un mapa. */
const PALETTE = ['#E5636B', '#2FB394', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#0EA5E9', '#D946EF']

/** Color estable para una vertical: sale de su identificador, así no cambia entre visitas. */
function colorFor(idCategory: string | null, name: string): string {
  const source = idCategory || name
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function categoryStyle(idCategory: string | null, name: string, icon?: string | null, color?: string | null): CategoryStyle {
  const normalized = normalizeName(name)
  const rule = EMOJI_RULES.find((item) => item.words.some((word) => normalized.includes(word)))
  return {
    emoji: icon && icon.length <= 4 ? icon : rule?.emoji || '📍',
    color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : colorFor(idCategory, name),
  }
}
