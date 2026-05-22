export const POSITIONS = [
  'Chairman',
  'Internal Vice Chairman',
  'External Vice Chairman',
  'Internal Secretary',
  'External Secretary',
  'Treasurer',
  'Auditor',
  'PIOs (Freshman)',
  'PIOs (Sophomore)',
  'PIOs (Junior)',
  'PIOs (Senior)',
  'Head Committee',
  'Vice Head Committee',
  'Committee Leader (Programming)',
  'Committee Leader (Graphics and Design)',
  'Committee Leader (Networking)',
  'Committee Leader (Gaming)',
] as const

export type TPosition = (typeof POSITIONS)[number]
