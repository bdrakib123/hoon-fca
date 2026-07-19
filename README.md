🚀 Hoon FCA

«Advanced Facebook Chat API for Node.js with Cookie Login, MQTT, Auto Reconnect, Token Refresh and modern Messenger features.»

---

✨ Features

- 🍪 Cookie / AppState Login
- ⚡ MQTT Real-Time Messaging
- 🔄 Auto Reconnect
- 🔐 Auto Re-Login
- ♻️ Token Refresh
- 💬 Send & Receive Messages
- ❤️ Message Reactions
- 👥 Thread & Group Management
- 🎨 Themes & Stickers
- 📊 Health Monitoring
- 🚀 Fast & Lightweight

---

📦 Installation

npm install @cexy/hoonfca

---

🚀 Quick Start

const fs = require("fs");
const { login } = require("@cexy/hoonfca");

const appState = JSON.parse(
  fs.readFileSync("appstate.json", "utf8")
);

login(
  { appState },
  {
    online: true,
    listenEvents: true,
    autoReconnect: true
  },
  (err, api) => {
    if (err) return console.error(err);

    console.log("Logged in:", api.getCurrentUserID());

    api.listenMqtt((err, event) => {
      if (err || event.type !== "message") return;

      if (event.body === "/ping") {
        api.sendMessage("🏓 Pong!", event.threadID);
      }
    });
  }
);

---

📋 Requirements

- Node.js v20.0.0 or higher

---

📚 Documentation

- Cookie / AppState Login
- MQTT Messaging
- Auto Reconnect
- Token Refresh
- Thread & Group APIs
- User APIs
- Themes & Stickers
- Health Status

---

🔗 Links

GitHub

https://github.com/hoon6t9/hinata-fca

NPM

https://www.npmjs.com/package/@cexy/hoonfca

---

❤️ Credits

Developed & Maintained by Hoon

Inspired by:

- ws3-fca
- @dongdev/fca-unofficial

---

📄 License

This project is licensed under the MIT License.

---

<p align="center">
Made with ❤️ by <b>Hoon</b>
</p>
