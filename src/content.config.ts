import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Maps each SKILL.md in the upstream submodule to a content entry whose `id`
// is the directory name (e.g. "writing-motoko", "icp-cli"). We keep the id as the
// URL slug so we never rely on computed slugs.
const skills = defineCollection({
  loader: glob({
    pattern: 'skills/*/SKILL.md',
    base: '.',
    // Strip `/SKILL` suffix so id is just the skill directory name.
    generateId: ({ entry }) => {
      const m = entry.match(/skills\/([^/]+)\/SKILL\.md$/);
      if (!m) throw new Error(`Unexpected skill path: ${entry}`);
      return m[1];
    },
  }),
  schema: z.object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    description: z.string().min(10),
    license: z.string().optional(),
    compatibility: z.string().optional(),
    metadata: z.object({
      title: z.string().min(1),
      category: z.string().min(1),
    }),
  }),
});

export const collections = { skills };
