# Architecture Overview

## Overview

SymptomCheck AI is a full-stack web application that allows users to analyze their symptoms using AI, track their health over time, and access premium features through a subscription model. The application follows a modern client-server architecture with a React frontend and Node.js/Express backend, using PostgreSQL for data storage.

## System Architecture

The system follows a monorepo structure with clear separation between client (frontend), server (backend), and shared code:

```
/
├── client/            # Frontend React application
│   ├── src/           # React source code
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Utility functions
│   │   ├── pages/     # Page components
├── server/            # Backend Express application
│   ├── auth.ts        # Authentication logic
│   ├── db.ts          # Database connection
│   ├── index.ts       # Main server entry point
│   ├── routes.ts      # API routes
│   ├── storage.ts     # Data access layer
│   ├── vite.ts        # Vite development server config
├── shared/            # Shared code between client and server
│   ├── schema.ts      # Database schema and type definitions
```

The application uses a modern JavaScript/TypeScript stack with the following key technologies:

- **Frontend**: React, TailwindCSS, shadcn/ui components, React Query
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based authentication
- **Payment Processing**: Stripe
- **AI Integration**: OpenAI API

## Key Components

### Frontend Architecture

The frontend is built with React and follows a component-based architecture:

1. **Pages**: Represent distinct routes in the application:
   - Home: Main landing page with symptom input form
   - Results: Displays AI analysis results
   - Tracker: Health tracking dashboard
   - Auth: Login/registration page

2. **Components**: Reusable UI elements organized by functionality:
   - Layout components (Header, Footer)
   - Feature-specific components (SymptomForm, ConditionCard, etc.)
   - UI components (based on shadcn/ui library)

3. **State Management**:
   - React Query for server state (API calls, data fetching)
   - Context API for application state (AuthProvider)
   - Component state for UI-specific state

4. **Routing**: Uses wouter for client-side routing

### Backend Architecture

The backend follows a layered architecture:

1. **API Layer**: Express routes defined in `server/routes.ts`
   - REST API endpoints for symptom analysis, user management, payments
   - Authentication middleware

2. **Service Layer**: Business logic implementation
   - OpenAI integration for symptom analysis
   - Stripe integration for payments
   - Authentication services

3. **Data Access Layer**: Abstracted in `server/storage.ts`
   - Database operations using Drizzle ORM
   - Transaction management

4. **Infrastructure**: Server configuration and middleware
   - Session management
   - Error handling
   - CORS and security

### Database Schema

The database schema is defined using Drizzle ORM in `shared/schema.ts` with the following main tables:

1. **users**: Stores user accounts and subscription information
   - Core fields: id, username, email, password, createdAt
   - Subscription fields: stripeCustomerId, stripeSubscriptionId, isPremium, subscriptionStatus
   - Usage tracking: analysisCount, analysisCountResetDate

2. **symptom_records**: Stores symptom analysis history
   - Fields: id, userId, symptoms, date

3. **daily_tracking**: Stores daily health tracking data
   - Fields: id, userId, date, symptomSeverity, energyLevel, mood, sleepQuality

### Authentication System

The application uses a session-based authentication system:

1. **Passport.js**: For authentication strategy management
2. **Local Strategy**: Username/password authentication
3. **Session Storage**: PostgreSQL-backed session store
4. **Password Security**: Scrypt for password hashing with salt

### Payment Processing

The application integrates with Stripe for subscription management:

1. **Subscription Plans**: Premium monthly plan
2. **Payment Flow**: Redirects to Stripe Checkout
3. **Webhook Integration**: For subscription status updates
4. **User Limits**: Free tier with limited analysis count

## Data Flow

### Symptom Analysis Flow

1. User inputs symptoms on the home page
2. Frontend sends data to `/api/analyze-symptoms` endpoint
3. Backend validates user's subscription status or free tier usage
4. If allowed, backend calls OpenAI API with the symptom data
5. AI response is processed, structured, and stored in the database
6. Response is returned to the frontend and displayed on the Results page

### Authentication Flow

1. User submits login credentials on Auth page
2. Frontend sends data to `/api/login` endpoint
3. Backend verifies credentials using Passport.js
4. Session is created and cookie is set
5. User state is updated on the frontend via React Query

### Subscription Flow

1. User clicks to upgrade to premium
2. Backend creates a Stripe Checkout session
3. User is redirected to Stripe payment page
4. After payment, Stripe sends webhook to update user subscription status
5. User is granted premium features

## External Dependencies

The application relies on several external services:

1. **OpenAI API**: For AI-powered symptom analysis
   - Used to process symptoms and generate potential conditions
   - Requires API key configuration

2. **Stripe**: For payment processing and subscription management
   - Handles payment information securely
   - Manages subscription lifecycle via webhooks

3. **Neon Database**: PostgreSQL database provider
   - Serverless PostgreSQL used for data storage
   - Connected via `@neondatabase/serverless` package

## Deployment Strategy

The application supports multiple deployment options:

1. **Render**: Configuration in `render.yaml`
   - Defines web service and database
   - Sets up environment variables
   - Configured for production deployment

2. **Replit**: Configuration in `.replit`
   - Development environment setup
   - Preview deployment capability

3. **Heroku**: Configuration in `Procfile`
   - Basic web process definition

4. **Build Process**:
   - Frontend: Vite for bundling React application
   - Backend: esbuild for bundling server code
   - Combined output in `dist` directory

5. **Environment Variables**:
   - Database connection string
   - OpenAI API key
   - Stripe API keys and webhook secrets
   - Session secret

The application is designed to be easily deployed to PaaS platforms with minimal configuration.