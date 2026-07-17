import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { chantSchema } from './content/schemas/chant';

const chantsCollection = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/chants',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: chantSchema,
});

export const collections = {
  chants: chantsCollection,
};
