# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in this repository.

## Project Overview

This is a TypeScript/Bun project for scraping movie theater showtimes. The project uses:
- **Runtime**: Bun (JavaScript runtime and package manager)
- **Language**: TypeScript with strict type checking
- **Dependencies**: Cheerio for HTML parsing, Effect for functional programming
- **Architecture**: Interface-based scraper system with pluggable theater implementations

## Build & Development Commands

### Package Management
```bash
bun install          # Install dependencies
bun add <package>    # Add a new dependency
bun add <package> -d # Add a dev dependency
```

### Running the Application
```bash
bun run index.ts     # Run the main application
bun index.ts         # Alternative way to run
```

### Type Checking
```bash
bun tsc --noEmit     # Run TypeScript compiler without emitting files
```

### Linting & Formatting
This project doesn't have explicit linting/formatting commands configured yet. Agents should:
- Follow the TypeScript strict mode configuration
- Use the existing code style patterns as reference

### Testing
No test framework is currently configured. When adding tests:
1. Choose an appropriate test framework (Jest, Vitest, Bun test, etc.)
2. Add test scripts to package.json
3. Follow the existing file structure patterns

## Code Style Guidelines

### Import Organization
- Use `import type` for type-only imports
- Group imports in this order:
  1. External library imports (e.g., `import * as cheerio from 'cheerio'`)
  2. Internal type imports (e.g., `import type { Showtime } from "../models/showtime"`)
  3. Internal value imports
- Use relative paths with `../` for parent directory navigation
- Use explicit file extensions only when required by TypeScript configuration

### TypeScript Configuration
- **Strict mode enabled**: All TypeScript strict rules are enforced
- **No implicit any**: All types must be explicitly declared
- **No unchecked indexed access**: Array/object access must be type-safe
- **ESNext target**: Use modern JavaScript features
- **Module resolution**: Bundler mode with preserved module structure

### Interface & Type Definitions
- Use `interface` for object shapes that might be extended
- Use `type` for unions, intersections, and utility types
- Export types from dedicated `models/` directories
- Use optional properties (`?`) for non-required fields
- Add JSDoc comments for complex interfaces

### Class & Function Patterns
- Implement interfaces explicitly (`implements TheaterScraper`)
- Use static properties for class-level constants
- Use async/await for asynchronous operations
- Return `Promise<T>` types for async methods
- Use null returns for invalid/filtered data (consistent with `eventElementToShowtime`)

### Error Handling
- Use null returns for filtering invalid data (see `eventElementToShowtime`)
- Implement filtering methods separately (see `filterShowtimes`)
- When adding promises, use explicit Promise constructor for compatibility

### File & Directory Structure
- `scrapers/models/`: Interface definitions and types
- `scrapers/theater_scrapers/`: Concrete scraper implementations
- `scrapers/mocks/`: Test data and HTML mocks
- Keep related functionality in the same directory
- Use descriptive, snake_case file names

### Naming Conventions
- **Classes**: PascalCase (e.g., `BeaconScraper`)
- **Interfaces**: PascalCase (e.g., `TheaterScraper`)
- **Methods**: camelCase (e.g., `getShowtimes`, `eventElementToShowtime`)
- **Variables**: camelCase (e.g., `calendar_mock`, `showtimes`)
- **Constants**: SCREAMING_SNAKE_CASE for static properties
- **Files**: snake_case (e.g., `beacon_scraper.ts`, `theater_scraper.ts`)

### Code Organization
- Place static properties at the top of classes
- Group related methods together
- Use private methods for internal logic (when needed)
- Keep methods focused and single-purpose
- Use array methods like `map`, `filter` for data transformations

### HTML Parsing with Cheerio
- Load HTML content using `cheerio.load()`
- Use CSS selectors for element selection
- Chain jQuery-style methods for element traversal
- Use `.text().trim()` for clean text extraction
- Use `.attr()` for attribute access with null checks
- Map cheerio collections to typed arrays using `.map().get()`

### Functional Programming (Effect library)
- The project includes Effect as a dependency
- When adding new functionality, consider using Effect for error handling and composition
- Follow existing patterns until Effect is more deeply integrated

## Development Workflow

1. **Adding new theaters**: 
   - Create new scraper class in `scrapers/theater_scrapers/`
   - Implement `TheaterScraper` interface
   - Add mock HTML data to `scrapers/mocks/`

2. **Modifying models**:
   - Update interfaces in `scrapers/models/`
   - Ensure backward compatibility when possible
   - Update all implementations

3. **Running the server**:
   - The main file includes a Bun HTTP server
   - Server runs on default port with API routes
   - Use for testing scraper endpoints

## Important Notes

- This is a private project (`"private": true`)
- Uses ES modules (`"type": "module"`)
- Bun runtime is required (not Node.js)
- No build step - TypeScript is handled by Bun directly
- The project includes mock data for development/testing