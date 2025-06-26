# Phases of backend:

1. **Phase 1: Database Schema Design with Prisma**

- Prisma schema setup: Models: `User`, `Friendship`, `Group`, `GroupMembers`, `Message`, `DeletedMessage`
- Polymorphic message re7lation (`privateChatId`, `groupId`)
- Timestamps `createdAt` added

2. **Phase 2: Authentication System**

- Register/Login with JWT
- Password hashing (`argon2`)
- JWT expiry config
- `/auth/me` route
- CSRF protection (toBeAdded)
- WebSocket JWT auth middleware

3. **Phase 3: WebSocket Gateway Implementation**

- Socket.IO setup
- Redis adapter for scaling
- Connection tracking + disconnection handling
- WebSocket event handlers: chat, friend requests
- JWT guard for sockets
- Global logging & error handling

4. **Phase 4: Friendship System**

- Send/Accept/Reject friend requests
- View pending/accepted requests
- Real-time friend request events
- Friends list + online status
- (Real-time events & online status missing as of now)

5. **Phase 5: Chat Functionality**

- 1:1 private messaging
- Real-time message delivery
- Group chat creation/joining
- Invite system with codes
- Chat history (REST)
- Message delete (for self/everyone)

6. **Phase 6: Additional Features(In Progress)**

- User profile update ✅
- User search (username/email) ✅
- Group admin controls (add/remove/change info) ✅
- Basic notifications ✅
- Presence tracking ✅
- Block/unblock users ✅
- Pagination for chat history ✅

**Phase 7: Security & Stability Enhancements**

- Add refresh token support ✅
- Implement OAuth (Google, etc.) ✅
- Apply rate limiting (login, socket, etc.) // ttl error
- Enable Helmet and security headers // already done
- Add audit logging (user actions, deletions) ✅
- Harden WebSocket guards and validation (half done)

---

**Phase 8: Chat UX Enhancements** (after phase 9)

- Message read receipts
- Typing indicators (WebSocket)
- File/image upload (S3/local)
- Chat history pagination
- Message search (by keyword/text)

---

**Phase 9: Monitoring, Testing, DevOps**

- Dockerize backend with multistage build
- Deploy with `kubernets`
- Integrate Prometheus / Grafana (metrics)
- Set up Sentry (error tracking)
- Unit & integration testing
- End-to-end (e2e) test flows
- API documentation with Swagger
