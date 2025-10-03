# Lead Management System - Project Brief

## Overview
A comprehensive lead management application built with Next.js, Supabase, and TailwindCSS that allows users to organize, track, and manage sales leads efficiently.

## Core Requirements
- **Lead Organization**: Categorize leads into different groups/categories
- **CSV Import**: Bulk import leads from CSV files with automatic category creation
- **Lead Management**: View, edit, and track individual lead details
- **Category Management**: Create, delete, and manage lead categories
- **Real-time Data**: Integration with Supabase for live data synchronization

## Key Features
- Dashboard with lead statistics and category overview
- CSV import functionality with Papa Parse integration
- Lead detail modal for viewing/editing individual leads
- Category-based lead filtering and organization
- Responsive design with modern UI components
- Real-time updates using Supabase

## Technical Stack
- **Frontend**: Next.js 15.5.4 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: TailwindCSS v4
- **CSV Processing**: Papa Parse
- **State Management**: React Query (@tanstack/react-query)
- **Date Handling**: React DatePicker

## Current Status
- Basic application structure is complete
- Main components (LeadList, ImportModal, LeadDetailModal) are implemented
- Supabase integration is functional
- Development server runs on localhost:3001
- Some styling and component issues need resolution
