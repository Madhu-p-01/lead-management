# System Patterns - Lead Management System

## Architecture Overview
- **Frontend**: Next.js 15 with App Router pattern
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **State Management**: React Query for server state, React hooks for local state
- **Component Structure**: Modular components with clear separation of concerns

## Database Schema
Based on the application code, the schema includes:
- `categories` table: Stores lead categories with id, name, created_at
- `lead_categories` table: Junction table linking leads to categories
- `leads` table: Stores individual lead information

## Key Design Patterns

### Component Architecture
- **Page Components**: Main route handlers (app/page.tsx)
- **Feature Components**: LeadList, ImportModal, LeadDetailModal
- **Utility Components**: CSVImport, UploadCSV, LeadTable
- **Shared Utilities**: Supabase client configuration

### Data Flow Patterns
1. **Category Management**: Load → Select → Display Leads → CRUD Operations
2. **Lead Import**: CSV Upload → Parse → Validate → Store → Refresh UI
3. **Lead Management**: Fetch → Display → Edit → Update → Sync

### Error Handling
- Async operation error boundaries
- User-friendly error messages
- Loading states for all data operations
- Confirmation dialogs for destructive actions

## Component Relationships
```
HomePage (app/page.tsx)
├── ImportModal
│   ├── CSVImport
│   └── UploadCSV
├── LeadList
│   ├── LeadTable
│   └── LeadDetailModal
└── Category Management (inline)
```

## Critical Implementation Patterns
- **Real-time Updates**: Supabase subscriptions for live data
- **Optimistic Updates**: React Query mutations with rollback
- **Form Handling**: Controlled components with validation
- **Modal Management**: State-driven modal visibility
- **CSV Processing**: Papa Parse for robust CSV handling
