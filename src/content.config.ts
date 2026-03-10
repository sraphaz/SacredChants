import { defineCollection } from 'astro:content';
import { chantSchema } from './content/schemas/chant';

const chantsCollection = defineCollection({
  type: 'data',
  schema: chantSchema,
});

export const collections = {
  chants: chantsCollection,
};
