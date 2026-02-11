import type { TNominee } from "@/@types"

  type Category = {
    id: string
    title: string
    description: string
    nominees: TNominee[]
  }

export const categories: Category[] = [
    {
      id: 'chairman',
      title: 'Chairman',
      description: 'Overall leader of the student organization.',
      nominees: [
        {
          id: 'chairman-1',
          name: 'Neil Vallecer',
          course: 'BSCS',
          position: "Chairman",
          manifesto: 'Ako ang pinaka batak diri',
        },
        {
          id: 'chairman-2',
          name: 'Kent Jay Otadoy',
          course: 'BSCS',
          position: "Chairman",
          manifesto: 'Ako sige rako pang konsehal diri',
        },
      ],
    },
    {
      id: 'head-committee',
      title: 'Head Committee',
      description: 'Leads and coordinates the working committees.',
      nominees: [
        {
          id: 'head-1',
          name: 'John Cez Casupanan',
          course: 'BSCS',
          position: "Head Committee",
          manifesto: 'Ako ang backup sa pinaka batak diri',
        },
        {
          id: 'head-2',
          name: 'Stanleigh Morales',
          course: 'BSCS',
          position: "Head Committee",
          manifesto: 'Sige rakog freelancer diri',
        },
      ],
    },
    {
      id: 'vice-committee',
      title: 'Vice Committee',
      description: 'Supports the head committee in daily operations.',
      nominees: [
        {
          id: 'vice-1',
          name: 'Elgin Karl Lastimoso',
          course: 'BSCS',
          position: "Vice Committee",
          manifesto: 'Shoutout diay ko sa senior high school dha',
        },
        {
          id: 'vice-2',
          name: 'Marc Ejay Cortes',
          course: 'BSCS',
          position: "Vice Committee",
          manifesto: 'Sa osa ka ticket mo PR maabot og osa ka buwan',
        },
      ],
    },
  ]