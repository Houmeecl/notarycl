# Overview

DocuSignPro is a comprehensive document management and digital signature platform built as a full-stack web application. The system serves as a unified platform that supports multiple business verticals including NotaryPro (digital notarization services), VecinoXpress (partner-based document services), and POS management systems. The platform provides document creation, digital signing, identity verification, payment processing, and certification services with advanced features like NFC document reading, biometric verification, and forensic document analysis.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/UI components built on top of Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and session management
- **Database ORM**: Drizzle ORM with PostgreSQL
- **File Handling**: Multer for file uploads with organized storage structure
- **API Design**: RESTful APIs with route separation by business domain

## Database Design
- **Primary Database**: PostgreSQL with connection pooling via Neon serverless
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Data Architecture**: Multi-tenant design with platform separation (notarypro, vecinos)
- **Key Tables**: Users, documents, partners, transactions, verification records, analytics events

## Mobile Integration
- **Capacitor**: For native mobile app deployment targeting Android
- **Progressive Web App**: Service worker and manifest for web app installation
- **Native Features**: Camera access, NFC reading, biometric verification

## Authentication & Authorization
- **Multi-Platform Authentication**: Separate authentication flows for different business verticals
- **Session Management**: Express-session with PostgreSQL store in production, memory store in development
- **Role-Based Access Control**: Admin, user, certifier, partner, supervisor roles with platform-specific permissions
- **Password Security**: Scrypt-based password hashing with salt

## Document Processing
- **File Upload**: Organized storage in uploads directory with categorization
- **Document Verification**: QR code generation and verification system
- **Digital Signatures**: PDF manipulation with pdf-lib for signature embedding
- **Document Forensics**: Python Flask microservice for document authenticity analysis
- **Template System**: Reusable document templates with dynamic field population

## Identity Verification
- **NFC Document Reading**: Support for Chilean ID cards with NFC chip data extraction
- **Biometric Verification**: Camera-based facial recognition and liveness detection
- **Multi-Factor Verification**: Combination of document scan, NFC, and biometric verification
- **API Integration**: GetAPI.cl integration for Chilean RUT and identity validation

## Payment Processing
- **Multiple Providers**: MercadoPago, Stripe, PayPal, and Tuu Payments integration
- **POS Terminal Support**: Hardware POS terminal integration for in-person transactions
- **Transaction Management**: Comprehensive transaction tracking and reconciliation
- **Commission System**: Partner-based commission calculation and payout management

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL with WebSocket connections
- **Email Service**: SendGrid for transactional emails
- **File Storage**: Local file system with organized directory structure

## Payment Processors
- **MercadoPago**: Argentine payment processing
- **Stripe**: International credit card processing  
- **PayPal**: Digital wallet and payment processing
- **Tuu Payments**: Chilean POS terminal and payment gateway

## Identity & Verification Services
- **GetAPI.cl**: Chilean identity verification and RUT validation
- **Web NFC API**: Browser-based NFC reading for document verification
- **MediaDevices API**: Camera access for biometric verification

## Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **Drizzle Kit**: Database schema management and migrations

## Mobile Development
- **Capacitor**: Cross-platform native app wrapper
- **Android SDK**: Native Android functionality
- **Progressive Web App**: Service workers and web app manifest

## Document Processing
- **PDF-lib**: PDF manipulation and signature embedding
- **QRCode**: QR code generation for document verification
- **Python Flask**: Microservice for document forensics analysis
- **Puppeteer**: PDF generation from HTML (excluded from client bundle)

## Analytics & Monitoring
- **Custom Analytics**: Event tracking system for user behavior
- **Error Handling**: Comprehensive error boundary and logging system
- **WebSocket**: Real-time communication for live features

## Recent Platform Organization (January 2025)
- **Code Cleanup**: Removed temporary files and organized file structure
- **TypeScript Fixes**: Resolved component routing type issues
- **Performance**: Optimized component loading patterns
- **Structure**: Implemented domain-based organization strategy
- **Authentication**: Stable MemStorage implementation with all test users