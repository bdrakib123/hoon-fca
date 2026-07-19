Hoon FCA

«🚀 Advanced Facebook Chat API for Node.js with Cookie Login, MQTT, Auto Reconnect, Token Refresh, and modern Messenger features.»

"Node.js" (https://img.shields.io/badge/Node.js-20%2B-green)
"License" (https://img.shields.io/badge/License-MIT-blue)
"Version" (https://img.shields.io/npm/v/@cexy/hoonfca)

---

✨ Features

- 🍪 Cookie/AppState Login
- ⚡ MQTT Real-time Messaging
- 🔄 Auto Reconnect
- 🔐 Auto Re-Login
- ♻️ Token Refresh
- 💬 Send & Receive Messages
- ❤️ Message Reactions
- 👥 Group & Thread Management
- 🎨 Themes & Stickers
- 📊 Session Health Monitoring
- 🚀 Fast & Lightweight

---

📦 Installation

npm install @cexy/hoonfca

---

🚀 Quick Start

const fs = require("fs");
const { login } = require("@cexy/hoonfca");

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

login({ appState }, {
  online: true,
  listenEvents: true,
  autoReconnect: true
}, (err, api) => {
  if (err) return console.error(err);

  console.log("Logged in:", api.getCurrentUserID());

  api.listenMqtt((err, event) => {
    if (err || event.type !== "message") return;

    if (event.body === "/ping") {
      api.sendMessage("🏓 Pong!", event.threadID);
    }
  });
});

---

📋 Requirements

- Node.js 20+

---

📚 Documentation

- Cookie Login (AppState)
- Auto Reconnect
- Token Refresh
- MQTT Messaging
- Thread & Group APIs
- User APIs
- Themes & Stickers
- Health Status

---

🔗 Links

- GitHub: https://github.com/hoon6t9/hinata-fca
- NPM: https://www.npmjs.com/package/@cexy/hoonfca

---

❤️ Credits

Developed & Maintained by Hoon

Inspired by ws3-fca and @dongdev/fca-unofficial.

---

📄 License

Released under the MIT License.
