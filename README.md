# Attendance App

A mobile application built with React Native and Expo for managing attendance.

## Features
- QR Code based attendance system
- Real-time attendance tracking
- User authentication
- Attendance statistics and reports
- Camera integration for QR scanning

## Tech Stack
- React Native
- Expo
- Supabase (Backend)
- React Navigation
- React Native Paper (UI Components)

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm
- Expo CLI

### Installation
1. Clone the repository:
```bash
git clone [your-repository-url]
cd attendance-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Project Structure
```
attendance-app/
├── assets/          # Images and other static assets
├── components/      # Reusable React components
├── navigation/      # Navigation configuration
├── screens/         # Screen components
├── utils/           # Utility functions
└── web/            # Web-specific code
```

## Environment Setup
Create a `.env` file in the root directory with the following variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.
