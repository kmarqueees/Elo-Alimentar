export const STORAGE_CONDITIONS = ['REFRIGERATED', 'FROZEN', 'DRY'] as const
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number]

export const FOOD_TYPES = [
  'HORTIFRUTI',
  'PANIFICADOS',
  'PRATOS_PRONTOS',
  'LATICINIOS',
  'CARNES',
  'NAO_PERECIVEIS',
] as const
export type FoodType = (typeof FOOD_TYPES)[number]
