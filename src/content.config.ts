import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string(),
      kind: z.enum(['commercial', 'personal']),
      featured: z.boolean(),
      clientType: z.string(),
      stack: z.array(z.string()),
      liveUrl: z.string().optional(),
      year: z.number(),
      summary: z.string(),
      outcome: z.string().optional(),
      cover: image()
    })
});

export const collections = { projects };
