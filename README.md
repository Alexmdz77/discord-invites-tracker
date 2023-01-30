<div align="center">
<h1>Discord Invites Tracker</h1>
<p>
    <a href="https://discord.gg/MguNNgXQTv"><img src="https://img.shields.io/discord/910543613560250398" alt="discord server" /></a>
    <a href="https://www.npmjs.com/package/discord-invites-tracker-sqlite"><img src="https://img.shields.io/npm/v/discord-invites-tracker-sqlite.svg" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/discord-invites-tracker-sqlite"><img src="https://img.shields.io/npm/dt/discord-invites-tracker-sqlite.svg" alt="npm downloads" /></a>
  </p>
</div>

## About

discord-invites-tracker is a simple [Node.js](https://nodejs.org) module that allows you to easily track invites of a guild

## Installation

```sh
npm install Alexmdz77/discord-invites-tracker-sqlite
# or
yarn add Alexmdz77/discord-invites-tracker-sqlite
```

## Example

```js
const { Client, Intents } = require("discord.js");
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_INVITES]
});

const tracker = new invitesTracker(client);

client.on('ready', () => {
    console.log(`${client.user.username} is ready!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || message.webhookId) return;

    if (message.content.startsWith('!invites')) {
        let invites = await invitesTracker.getInvites(message.author, message.guild);
        message.reply(`${message.author} has ${invites} invites`);
    };
});

tracker.on("guildMemberAdd", (member) => {
    const welcomeChannel = member.guild.channels.cache.get("YOUR WELCOME CHANNEL ID HERE");

    if (!member.inviter) return welcomeChannel.send(`I'm unable to track who invited ${member}`);
    else return welcomeChannel.send(`Welcome ${member}! Invited by ${member.inviter} (${member.invites} invites)`);
});

client.login("YOUR BOT TOKEN HERE");
```
