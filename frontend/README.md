# Waitlist Management Dashboard

A modern React frontend for the Waitlist Management System built with TypeScript, Tailwind CSS, and Headless UI.

## Features

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark/Light Mode**: Automatic theme detection with manual toggle
- **Modern UI Components**: Built with Headless UI for accessibility
- **Real-time Updates**: Dashboard shows live slot and waitlist status
- **Advanced Filtering**: Comprehensive search and filter capabilities
- **Settings Management**: Tabbed interface for business configuration
- **Message Logging**: Track email delivery and customer responses
- **Accessibility**: WCAG compliant with comprehensive keyboard navigation

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Headless UI** for accessible components
- **Heroicons** for consistent iconography
- **React Router** for navigation
- **Axios** for API communication
- **date-fns** for date formatting
- **Vitest** for testing
- **React Testing Library** for component testing

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── settings/       # Settings page components
│   └── __tests__/      # Component tests
├── contexts/           # React contexts (Auth, Theme)
├── pages/              # Page components
├── services/           # API services
├── test/               # Test setup and utilities
└── __tests__/          # Integration and accessibility tests
```

## Key Components

### Dashboard
- Real-time overview of open slots, pending holds, and bookings
- Quick actions for slot management
- Modern card-based layout with animations

### Waitlist Management
- Advanced data table with filtering and sorting
- Bulk actions for managing multiple entries
- Priority scoring visualization

### Settings
- Tabbed interface for different configuration areas
- Business hours management
- Service and staff configuration
- Email template customization

### Message Log
- Comprehensive delivery tracking
- Status indicators and search functionality
- Customer response monitoring

## Accessibility Features

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader optimized
- High contrast mode support
- Focus management
- Semantic HTML structure

## Testing

The project includes comprehensive tests:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Context and service testing  
- **Accessibility Tests**: WCAG compliance verification

Run tests with:
```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Visual test runner
```

## Development

The frontend is configured to proxy API requests to `http://localhost:8000` during development. Make sure the backend server is running on port 8000.

### Environment Variables

No environment variables are required for development. The frontend uses relative API paths that are proxied to the backend.

### Building

The build process:
1. TypeScript compilation
2. Vite bundling with optimizations
3. Tailwind CSS purging for minimal bundle size
4. Asset optimization

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with ES2020 support