# Webcup Features

## Authentication & Authorization
- Email/password sign-up with verification
- Password reset via email
- Two-factor authentication (TOTP)
- RBAC: Admin, Moderator, Standard User
- Session management via BetterAuth

## Content
- Posts: create, edit, delete, detail view
- Rich filtering and pagination
- AI-assisted content actions (rewrite, summarize, analyze tone)

## Realtime
- Socket.IO transport with automatic polling fallback
- Typing indicators and user presence
- Notification system with read/unread state

## Admin Panel
- User management (ban, role change, impersonate)
- Content moderation queue
- Audit log with filterable entries
- Feature flags and configuration

## AI Assistant
- OpenRouter integration (Gemini 2.0 Flash / Llama 3.3)
- Context-aware assistance
- Quota tracking

## System
- i18n: FR/EN with locale cookie
- Dark/light theme toggle
- Responsive design with mobile-first approach
- Security headers (CSP, HSTS, X-Frame-Options)
- Request logging and error reporting
