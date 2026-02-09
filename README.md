# Code Paradox – Real-Time Collaborative Code Editor

Code Paradox is a **real-time collaborative JavaScript code editor** that allows multiple users to join a room and write code together with live updates, syntax highlighting, and instant execution.

It provides a **VS Code–like experience in the browser** with live collaboration features.

---

## 🚀 Features

- Real-time collaborative editing using Socket.io
- Unique room ID for each coding session
- Live code execution
- Syntax highlighting with CodeMirror
- VS Code–like autocomplete suggestions
- User avatars for connected participants
- Join/leave toast notifications

---

## 🛠️ Tech Stack

### Frontend
- HTML
- CSS
- JavaScript
- CodeMirror

### Backend
- Node.js
- Express.js
- Socket.io

### Tools & Libraries
- UUID (room ID generation)
- Toast notifications
- CodeMirror themes & extensions

---


---
## ⚙️ Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/PiyushGaywal/Code-Paradox.git
cd Code-Paradox

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
http://localhost:3000
