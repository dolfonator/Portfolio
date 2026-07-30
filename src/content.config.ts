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
      displayOrder: z.number().int().positive(),
      clientType: z.string(),
      stack: z.array(z.string()),
      liveUrl: z.string().optional(),
      /** Overrides the default live-link button label (e.g. when the link is a demo build). */
      liveLabel: z.string().optional(),
      /** Short note shown beside the live link — e.g. demo credentials. */
      demoNote: z.string().optional(),
      repoUrl: z.string().optional(),
      year: z.number(),
      summary: z.string(),
      blurb: z.string().optional(),
      outcome: z.string().optional(),
      coverAlt: z.string().optional(),
      cover: image()
    })
});

export const collections = { projects };
