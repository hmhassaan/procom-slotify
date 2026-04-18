# PROCOM Slotify 📅

A modern scheduling management platform built with Next.js, Firebase, and AI-assisted development.

## 🎯 Project Overview

PROCOM Slotify is a web application designed to streamline scheduling workflows. It provides users with tools to create, view, and manage schedules, with administrative capabilities for managing the platform.

### Development Note

This project was **built using Firebase Studio's vibe coding approach** — leveraging AI-assisted code generation and Firebase's rapid development tools. The commit history reflects this exploratory development style, demonstrating how modern developers can quickly build full-stack applications with AI guidance and low-code platforms.

## ✨ Features

- **User Authentication** - Secure Firebase-based authentication system
- **Schedule Management** - Create, view, and manage personal schedules
- **Admin Panel** - Role-based administrative interface for system management
- **Responsive Design** - Mobile-first UI built with Tailwind CSS and Radix UI components
- **Real-time Updates** - Firebase Firestore integration for instant data synchronization
- **AI Integration** - Google Genkit for enhanced features

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Firebase (Auth, Firestore)
- **AI**: Google Genkit
- **State Management**: React Context
- **Forms**: React Hook Form + Zod validation
- **Additional**: dnd-kit for drag-and-drop, recharts for analytics, xlsx for exports

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase project setup
- Google Cloud credentials for Genkit AI

### Installation

```bash
# Clone the repository
git clone https://github.com/hmhassaan/procom-slotify.git
cd procom-slotify

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your Firebase and API credentials to .env.local

# Run development server
npm run dev
```

The app will be available at `http://localhost:9003`

## 📋 Available Scripts

```bash
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run genkit:dev   # Genkit AI development mode
npm run genkit:watch # Genkit watch mode
```

## 📁 Project Structure

```
src/
├── app/              # Next.js app directory and pages
├── components/       # Reusable React components
├── context/          # React Context (Auth, App state)
├── ai/              # Genkit AI configurations
└── lib/             # Utility functions
```

## 🔐 Key Pages

- **Home** (`/`) - Main dashboard
- **Add Schedule** (`/add-schedule`) - Create new schedules
- **View Schedule** (`/view-schedule`) - Browse schedules
- **Admin Panel** (`/admin`) - Admin interface (role-based)
- **Login** (`/login`) - User authentication

## 🌐 Live Demo

Visit the live application: https://procom-slotify.vercel.app

## 📚 Learning Outcomes

This project demonstrates:
- Rapid prototyping with AI-assisted development
- Firebase integration in modern Next.js applications
- Building scalable React applications with TypeScript
- Effective use of low-code platforms for MVP development

## 🚀 Deployment

The application is deployed on Vercel and automatically deploys on push to main.

To deploy locally:
```bash
npm run build
npm start
```

## 📝 License

MIT License - Feel free to use this project for learning or as a reference.

## 👤 Author

[hmhassaan](https://github.com/hmhassaan)

---

**Built with Firebase Studio 🔥 and a vibe-coding approach ✨**

This project showcases how modern development tools enable rapid prototyping and MVP creation. While the commit messages reflect the exploratory nature of AI-assisted development, the result is a functional, production-ready application.