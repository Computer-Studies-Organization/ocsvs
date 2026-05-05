import { Filter } from 'bad-words'

const filter = new Filter()

export interface ProfanityValidationResult {
  isClean: boolean
  message?: string
}

export function validateProfanity(text: string, fieldName: string): ProfanityValidationResult {
  if (filter.isProfane(text)) {
    return {
      isClean: false,
      message: `${fieldName} contains inappropriate language`,
    }
  }

  return {
    isClean: true,
  }
}
