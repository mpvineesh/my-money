# My Money - Investment Tracker

A modern, mobile-friendly investment tracking application built with React.js and Vite. Track all your financial instruments including stocks, mutual funds, fixed deposits, PF, PPF, NPS, gold, bonds, and more.

## Features

- **📊 Dashboard** - Portfolio overview with asset allocation pie chart, total value, returns, and goals progress
- **💼 Investments** - View, search, filter, and sort all investments by type, value, or returns
- **🎯 Goals** - Set and track financial goals with progress visualization
- **➕ Add/Edit** - Full forms for adding and editing investments and goals
- **🔍 Search & Filter** - Filter investments by type, sort by value/returns/name
- **📱 Mobile First** - Responsive design optimized for mobile with bottom navigation
- **💾 Persistent Storage** - All data saved in localStorage
- **🇮🇳 INR Currency** - All amounts formatted in Indian Rupees

## Supported Investment Types

Stocks, Mutual Funds, Fixed Deposits, Recurring Deposits, PPF, EPF/PF, NPS, Gold, Real Estate, Bonds, Crypto, Insurance/ULIP, Savings Account, SSY, ELSS, and more.

## Tech Stack

- **React 19** with Vite for fast development
- **React Router DOM** for client-side routing
- **Recharts** for interactive charts
- **Lucide React** for beautiful icons
- **CSS** with mobile-first responsive design
- **localStorage** for data persistence

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── BottomNav.jsx  # Bottom navigation bar
│   ├── InvestmentCard.jsx  # Investment display card
│   └── GoalCard.jsx   # Goal progress card
├── context/           # React Context for state management
│   ├── AppContext.jsx  # Provider with CRUD operations
│   ├── AppContextDef.js # Context definition
│   └── useApp.js      # Custom hook for accessing context
├── pages/             # Page components
│   ├── Dashboard.jsx   # Main dashboard with overview
│   ├── Investments.jsx # Investment list with search/filter
│   ├── Goals.jsx       # Goals list with progress
│   ├── AddPage.jsx     # Add new investment or goal
│   ├── InvestmentForm.jsx # Add/Edit investment form
│   └── GoalForm.jsx    # Add/Edit goal form
└── utils/             # Utility functions
    ├── constants.js   # Types, formatting, demo data
    └── storage.js     # localStorage operations
```

## License

MIT
