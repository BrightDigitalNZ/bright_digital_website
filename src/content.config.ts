// Astro 6 content collection. MDX files in src/content/blog/ are discovered
// via the glob loader and validated against the schema below at build time.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    relatedServices: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    readingTime: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
