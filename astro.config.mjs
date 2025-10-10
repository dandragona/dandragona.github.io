// @ts-check
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});