# Technical Context - Lead Management System

## Technology Stack

### Frontend Framework
- **Next.js 15.5.4**: App Router, Turbopack for development
- **React 19.1.0**: Latest stable version with concurrent features
- **TypeScript 5**: Type safety and enhanced developer experience

### Database & Backend
- **Supabase**: PostgreSQL database with real-time subscriptions
- **@supabase/supabase-js 2.58.0**: Official JavaScript client

### Styling & UI
- **TailwindCSS 4.1.14**: Utility-first CSS framework
- **@tailwindcss/postcss 4**: PostCSS integration
- **shadcn-ui 0.9.5**: UI component library

### Data Management
- **@tanstack/react-query 5.90.2**: Server state management
- **Papa Parse 5.5.3**: CSV parsing and processing
- **React DatePicker 8.7.0**: Date input handling

## Development Configuration

### Package Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build --turbopack", 
  "start": "next start"
}
```

### Environment Setup
- Development server runs on localhost:3001 (port 3000 in use)
- Environment variables stored in `.env.local`
- Supabase configuration in `app/utils/supabase.js`

### Known Technical Issues
1. **TailwindCSS Error**: `rounded-2xl` utility class not recognized
2. **CSVImport Component**: Reference error - component not properly defined
3. **Node.js Version Warning**: Supabase recommends Node.js 20+ (currently using 18)
4. **Multiple Lockfiles**: Warning about workspace root detection

## File Structure
```
├── app/
│   ├── components/        # React components
│   ├── utils/            # Utility functions (Supabase client)
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page component
├── public/               # Static assets
├── memory-bank/          # Project documentation
└── Configuration files   # Next.js, Tailwind, TypeScript configs
```

## Dependencies Notes
- Using React 19 (latest) with Next.js 15
- Supabase client handles authentication and real-time features
- React Query provides caching and synchronization
- Papa Parse chosen for robust CSV handling with error recovery
