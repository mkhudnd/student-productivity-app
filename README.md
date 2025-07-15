# 📚 Student Productivity App

> A comprehensive mobile application designed to enhance student productivity through integrated planning, tracking, and learning tools.

[![React Native](https://img.shields.io/badge/React%20Native-0.79.3-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53.0.10-black.svg)](https://expo.dev/)
[![License](https://img.shields.io/badge/License-0BSD-green.svg)](LICENSE)

## 🎯 Project Overview

The Student Productivity App is a cross-platform mobile application built with React Native and Expo that combines essential academic tools into a unified, intuitive interface. This project demonstrates modern mobile development practices and provides real-world value for student organization and productivity.

### 🌟 Key Features

- **📅 Smart Daily Planner**: Visual 24-hour timeline with task scheduling and notifications
- **📊 Study Time Tracker**: Subject-based time logging with analytics and progress charts
- **🎴 Digital Flashcards**: Create, organize, and study with custom flashcard decks
- **⚙️ Customizable Settings**: Theme switching, analytics dashboard, and preferences
- **🔔 Smart Notifications**: Automated reminders with repeat patterns
- **📱 Offline-First Design**: Full functionality without internet dependency

## 🛠️ Technical Stack

### Frontend
- **React Native** 0.79.3 - Cross-platform mobile development
- **Expo SDK** 53 - Development platform and build tools
- **React Navigation** 7.x - Navigation and routing
- **React Hooks & Context** - State management

### Key Dependencies
- `@react-navigation/native` - App navigation
- `@react-native-async-storage/async-storage` - Local data persistence
- `expo-notifications` - Push notifications and scheduling
- `react-native-calendars` - Calendar components
- `react-native-chart-kit` - Data visualization
- `expo-file-system` - File storage and management

### Development Tools
- **EAS Build** - Production build system
- **Expo CLI** - Development workflow
- **ESLint** - Code quality assurance

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo Go app on your mobile device
- Android Studio (for Android development) or Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mkhudnd/student-productivity-app.git
   cd student-productivity-app/StudentProductivity
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

### 📱 Running on Your Device

#### Option 1: Using Expo Go (Recommended for Testing)

1. **Install Expo Go** on your mobile device:
   - [Android - Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Start the development server**:
   ```bash
   cd StudentProductivity
   npm start
   ```

3. **Connect your device**:
   - **Android**: Scan the QR code with the Expo Go app
   - **iOS**: Scan the QR code with your camera app, then open with Expo Go

4. **Alternative connection methods**:
   - Press `a` to open on Android device/emulator
   - Press `i` to open on iOS simulator
   - Press `w` to open in web browser

#### Option 2: Development Build

For a more native experience:

```bash
# Android
npm run android

# iOS
npm run ios
```

#### Option 3: Production Build

```bash
# Build for Android
npm run build:android

# Build for production
npm run build:android:production
```

### 🔧 Environment Setup

1. **Development Environment**:
   ```bash
   # Install Expo CLI globally
   npm install -g @expo/cli
   
   # Verify installation
   expo --version
   ```

2. **For Physical Device Testing**:
   - Ensure your device and computer are on the same Wi-Fi network
   - Enable Developer options on Android (if using Android device)

## 📖 Usage Guide

### Daily Planner
- **Add Events**: Tap the "+" button to create new scheduled activities
- **Categories**: Choose from Study, Exercise, Devotion, or Assignment
- **Time Blocks**: Select start and end times with visual timeline
- **Notifications**: Set automatic reminders for scheduled tasks
- **Completion Tracking**: Mark tasks as complete and monitor progress

### Study Tracker
- **Log Sessions**: Record study time by subject with start/stop timer
- **Analytics**: View charts showing study patterns and total time per subject
- **Subject Management**: Add, edit, and organize study subjects
- **Progress Monitoring**: Track productivity trends over time

### Flashcards
- **Create Decks**: Build flashcard sets for different subjects
- **Add Cards**: Input question/answer pairs with rich text support
- **Study Mode**: Flip through cards with intuitive touch controls
- **Deck Organization**: Edit, delete, and organize your flashcard collections

## 🏗️ Project Structure

```
StudentProductivity/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Auth/           # Authentication screens
│   │   ├── Flashcards/     # Flashcard functionality
│   │   ├── Planner/        # Daily planning features
│   │   ├── Settings/       # App configuration
│   │   └── Tracker/        # Study time tracking
│   ├── navigation/         # App navigation setup
│   ├── context/           # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   └── storage/           # Data persistence logic
├── assets/                # Images, icons, and media
├── android/              # Android-specific configuration
└── package.json          # Project dependencies
```

## 🎨 Features Demo

### Visual Design
- **Modern UI/UX**: Clean, intuitive interface following Material Design principles
- **Theme Support**: Light and Dark mode with system preference detection
- **Responsive Layout**: Optimized for various screen sizes and orientations
- **Smooth Animations**: Enhanced user experience with React Native Reanimated

### Data Management
- **Offline-First**: Full functionality without internet connection
- **Local Storage**: Efficient data persistence with AsyncStorage
- **Export Capabilities**: CSV export for study analytics
- **Data Migration**: Seamless app updates with data preservation

## 🔍 Technical Highlights

### Performance Optimizations
- **Memory Management**: Efficient component lifecycle management
- **Lazy Loading**: Optimized screen rendering and navigation
- **Background Processing**: Smart notification scheduling
- **Bundle Optimization**: Minimized app size and load times

### Code Quality
- **Component Architecture**: Modular, reusable component design
- **TypeScript Support**: Type safety for enhanced development
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Testing Ready**: Structured for unit and integration testing

## 📊 Development Metrics

- **Lines of Code**: ~3,000+ lines of well-documented code
- **Components**: 20+ reusable React Native components
- **Screens**: 15+ fully functional app screens
- **Dependencies**: 20+ carefully selected production packages
- **Build Size**: ~50-80MB optimized production build

## 🚀 Deployment

This app is ready for deployment to:
- **Google Play Store** (Android)
- **Apple App Store** (iOS)
- **Expo Application Services** (OTA updates)
- **Internal Distribution** (APK/IPA files)

## 🤝 Contributing

This project showcases modern mobile development practices and is open for collaboration:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Documentation

- **[User Manual](USER_MANUAL.md)**: Comprehensive 40+ page usage guide
- **[Executive Summary](EXECUTIVE_SUMMARY.md)**: Project overview and technical achievements
- **[Development Guide](CAPSTONE_SDLC.md)**: Software development lifecycle documentation

## 👨‍💻 Developer

**GitHub**: [@mkhudnd](https://github.com/mkhudnd)

This project demonstrates proficiency in:
- Cross-platform mobile development
- React Native and Expo ecosystem
- Modern JavaScript/React patterns
- Mobile UI/UX design principles
- Data persistence and state management
- Production-ready app development

## 📄 License

This project is licensed under the 0BSD License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ using React Native and Expo* 
