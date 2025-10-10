# GEMINI.md

## Project Overview

This is a personal website and blog built with the [Astro](https://astro.build/) framework. The site is designed to be a portfolio and a place to share articles.

The project uses a combination of technologies:
- **Astro** for the overall site structure and templating.
- **React** for interactive UI components.
- **Three.js** (via `@react-three/fiber` and `@react-three/drei`) for creating 3D graphics, as seen with the `BlochSphere` component on the homepage.
- **TypeScript** for type safety.
- **Markdown** for blog post content, with support for mathematical equations using **KaTeX**.

The website has a clean, modern design with gradient text effects and animated UI elements. It includes a homepage, a blog index page that lists all posts, and individual blog post pages.

## Building and Running

All commands should be run from the root of the project.

1.  **Install Dependencies:**
    ```sh
    npm install
    ```

2.  **Run the Development Server:**
    Starts a local development server with hot-reloading.
    ```sh
    npm run dev
    ```
    The site will be available at `http://localhost:4321`.

3.  **Build for Production:**
    Builds a static version of the site in the `dist/` directory.
    ```sh
    npm run build
    ```

4.  **Preview the Production Build:**
    Starts a local server to preview the contents of the `dist/` directory.
    ```sh
    npm run preview
    ```

## Development Conventions

### Project Structure
- **Pages**: All pages are located in `src/pages/`. Astro uses a file-based routing system.
- **Blog Posts**: Blog posts are written in Markdown and stored in `src/pages/blog/`. They use frontmatter to define metadata like `title`, `description`, and `layout`.
- **Layouts**: Page layouts are in `src/layouts/`. The main `Layout.astro` provides the common HTML structure, navigation, and styling. `BlogPostLayout.astro` is used for individual blog posts.
- **Components**: Reusable components are placed in `src/components/`. This project includes React components (`.jsx`) for interactive elements.
- **Styling**: Global styles are defined in `src/styles/global.css`. Component-specific styles are often co-located within the `.astro` or `.jsx` files themselves.
- **Static Assets**: Files in the `public/` directory are served at the root of the site.
- **Documents**: The `pdfs/` directory contains PDF files, which can be linked from pages.

### Content Creation
To create a new blog post, add a new `.md` file to the `src/pages/blog/` directory. The file should include a frontmatter section:

```markdown
---
layout: ../../layouts/BlogPostLayout.astro
title: "Your Post Title"
pubDate: YYYY-MM-DD
description: "A short summary of your post."
---

Your content here. You can use Markdown and KaTeX for math, like so: $E=mc^2$.
```
