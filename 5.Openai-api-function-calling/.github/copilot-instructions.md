# AI Coding Agent Instructions

## Project Overview
This is a React 19 + TypeScript + Vite application with shadcn/ui component library integration and Tailwind CSS styling. The React Compiler is enabled for performance optimization.

## Grounding
**ALWAYS** refer to the docs and resources specified below when implementing the OpenAI Responses API and tool / function calling. Stay as close to the code examples in the docs as possible. Provide comments with links to the relevant documentation sections in your code to show where you are following the instructions.

Use the OpenAIDeveloperDocs MCP server and its tools to find docs.

### Source of Truth for OpenAI API & Function Calling
- `./DOCS/function-calling.md` - When implemneting tool and function calling, use this as your primary reference for instructions and code examples.
- `./DOCS/conversation-state.md` - When implementing conversation state management, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-web-search.md` - When implementing web search tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-code-interpreter.md` - When implementing code interpreter tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-image-generation.md` - When implementing image generation tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-connectors-mcp.md` - When implementing MCP connectors, use this as your primary reference for instructions and code examples.
- Use the [Official API reference for Responses API](https://platform.openai.com/docs/api-reference/responses) for implementing any features related to the Responses API, including streaming responses and handling different event types.
- Use the [Responses API streaming events documentation](https://platform.openai.com/docs/api-reference/responses-streaming) for the full registry and details of streaming events.

## Architecture & Key Dependencies
- **Framework**: React 19 with TypeScript 5.9
- **Build Tool**: Vite 7.2 with `@vitejs/plugin-react` for Fast Refresh
- **UI Components**: shadcn/ui (configured in `components.json`)
- **Styling**: Tailwind CSS 4.x via `@tailwindcss/vite` plugin with CSS variables
- **Icons**: lucide-react for SVG icons
- **Utilities**: class-variance-authority (CVA) for component variants, clsx + tailwind-merge for className merging

## Path Aliases & Imports
All paths are aliased via `tsconfig.json` and `components.json`:
- `@/*` → `src/*` (main source path)
- `@/components` → `src/components` (UI component directory)
- `@/lib` → `src/lib` (utilities and helpers)
- `@/hooks` → `src/hooks` (custom React hooks)
- `@/ui` → `src/components/ui` (shadcn/ui components)

Always use `@/` imports; relative imports are not used.

## Component Patterns
- **shadcn/ui Components**: Use `@/components/ui` for base components; add new components via `npx shadcn@latest add <component-name>`
- **Utility Classnames**: Use the `cn()` function from `@/lib/utils.ts` to merge Tailwind classes (handles conflicts via tailwind-merge)
- **Styling**: Write classes directly in JSX; use CVA for complex component variants

Example:
```tsx
import { cn } from "@/lib/utils"
import Button from "@/components/ui/button"

export function MyComponent({ variant }: { variant?: "primary" | "secondary" }) {
  return <button className={cn("px-4 py-2", variant === "secondary" && "bg-gray-200")} />
}
```

## Development Workflow
- **Development Server**: `npm run dev` (Vite HMR enabled)
- **Type Checking & Build**: `npm run build` runs `tsc -b` before Vite build
- **Linting**: `npm run lint` (ESLint 9 with React hooks/refresh rules)
- **Preview**: `npm run preview` serves built output

Always run `npm run lint` before committing; TypeScript compilation is strict.

## React & TypeScript Conventions
- **React Compiler**: Enabled by default; avoid `useMemo`/`useCallback` unless necessary
- **Functional Components**: All components use function declarations
- **Hooks**: Place hooks at component top level; custom hooks in `@/hooks` directory
- **Type Safety**: Enable strict mode; export explicit component prop interfaces

## Tailwind & CSS Variables
- **CSS Variables**: Tailwind uses CSS custom properties (configured in `src/index.css`)
- **Base Colors**: shadcn/ui uses "slate" as base color with HSL format for theming
- **Animations**: `tw-animate-css` package available for advanced animations

## ESLint Configuration
Rules enforced:
- React hooks dependencies (via `eslint-plugin-react-hooks`)
- React Fast Refresh (via `eslint-plugin-react-refresh`)
- TypeScript best practices (via `typescript-eslint`)

Configuration in `eslint.config.js` uses modern flat config format (ESLint 9+).

## File Structure
```
src/
  components/          # React components
    ui/               # shadcn/ui components (auto-generated)
  lib/                # Utilities (cn() function, etc.)
  hooks/              # Custom React hooks
  assets/             # Static images
  App.tsx             # Root component
  main.tsx            # React DOM entry point
  index.css           # Tailwind + CSS variables
```

## Adding New Components from shadcn/ui
Use shadcn MCP tools to discover and add components:
- `mcp_shadcn_search_items_in_registries` to find components by name
- `mcp_shadcn_get_item_examples_from_registries` to view usage examples
- `mcp_shadcn_get_add_command_for_items` to get the exact add command
- Run the generated command: `npx shadcn@latest add <component-name>`

Components are generated into `src/components/ui/` with Tailwind-based styling.

## Browser testing with Playwright
Use the Playwright MCP tools to generate test code for browser testing.

Each folder in `./src/pages/` will have `test-chat.md` file with chat messages to send in the app and expected responses. Use the `mcp_playwright_generate_test_code` tool to generate test code based on these messages and expected responses. This will help ensure that the app is working correctly from the user's perspective.

## Notes for Agents
- Always use the `cn()` utility for conditional classnames
- Prefer built-in shadcn/ui components over custom HTML elements
- Keep components small and focused; extract to separate files in `src/components/`
- Maintain TypeScript strict mode compliance
- Use path aliases (`@/`) exclusively for imports
