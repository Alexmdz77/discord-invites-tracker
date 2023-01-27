const { EventEmitter } = require('events');

const Keyv = require('keyv');
const keyv = new Keyv('sqlite://database.sqlite');

module.exports = class extends EventEmitter {
    constructor(client, options = {}) {
        super();
        if (!client) throw new Error('Pass the client in options.');
        this.client = client;
        

        const fetchInvites = async (guild) => {
            return await new Promise((resolve) => {
                guild.invites.fetch().then((invites) => {
                    let guildInviteCount = {};
                    invites.forEach((invite) => {
                        const { inviter, uses } = invite;
                       if(inviter) guildInviteCount[inviter.id] = (guildInviteCount[inviter.id] || 0) + uses;
                    });
                    resolve(guildInviteCount);
                });
            });
        };
        let invitesCount = {};

        this.client.on('ready', async () => {
            client.guilds.cache.forEach(async (guild) => {
                invitesCount[guild.id] = await fetchInvites(guild);
            });
        });

        this.client.on('guildMemberAdd', async (member) => {
            const { guild } = member;

            const invitesBefore = invitesCount[guild.id];
            const invitesAfter = await fetchInvites(guild);
            let isVanity = true;

            for (const inviter in invitesAfter) {
                if (invitesAfter[inviter] - invitesBefore[inviter] === 1) {
                    let data = {
                        guildId: guild.id,
                        userId: member.id,
                        invitedBy: inviter
                    };
                    await keyv.set(`invitestracker_${guild.id}_${member.id}`, data);
                    const user = await client.users.fetch(inviter);
                    member.inviter = user;
                    let getData = await new Promise(async (resolve) => {
                        let userData = await keyv.get(`invitestracker_${guild.id}_${inviter}`);
                        if (!userData || !userData.invites) {
                            userData = {
                                guildId: guild.id,
                                userId: inviter,
                                invites: {
                                    regular: 0,
                                    bonus: 0,
                                    leaves: 0,
                                    fake: 0,
                                    total: 0
                                }
                            };
                        };
                        userData.invites = {
                            regular: userData.invites.regular + 1,
                            bonus: userData.invites.bonus,
                            leaves: userData.invites.leaves,
                            fake: userData.invites.fake,
                            total: userData.invites.total + 1
                        }
                        await keyv.set(`invitestracker_${guild.id}_${inviter}`, userData);
                        resolve(userData);
                    });
                    member.invites = getData.invites;
                    invitesCount[guild.id] = invitesAfter;
                    isVanity = false;
                    return this.emit('guildMemberAdd', member);
                }
            };
            if (!isVanity) return;
            member.inviter = 'vanity';
            let data = {
                guildId: guild.id,
                userId: member.id,
                invitedBy: 'vanity'
            };
            await keyv.set(`invitestracker_${guild.id}_${member.id}`, data);
            let getData = await new Promise(async (resolve) => {
                let userData = await keyv.get(`invitestracker_${guild.id}_${member.id}`);
                if (!userData || !userData.invites) {
                    userData = {
                        guildId: guild.id,
                        userId: member.id,
                        invites: {
                            regular: 0,
                            bonus: 0,
                            leaves: 0,
                            fake: 0,
                            total: 0
                        }
                    };
                };
                userData.invites = {
                    regular: userData.invites.regular,
                    bonus: userData.invites.bonus,
                    leaves: userData.invites.leaves,
                    fake: userData.invites.fake,
                    total: userData.invites.total
                }
                await keyv.set(`invitestracker_${guild.id}_${member.id}`, userData);
                resolve(userData);
            });
            member.invites = getData.invites;
            return this.emit('guildMemberAdd', member);
        });

        this.client.on('guildMemberRemove', async (member) => {
            const { guild } = member;
            let data = await keyv.get(`invitestracker_${guild.id}_${member.id}`);
            if (!data) return;
            let userData = await keyv.get(`invitestracker_${guild.id}_${data.invitedBy}`);
            if (userData && userData.invites) {
                userData.invites = {
                    regular: userData.invites.regular,
                    bonus: userData.invites.bonus,
                    leaves: userData.invites.leaves + 1,
                    fake: userData.invites.fake,
                    total: userData.invites.total == 0 ? 0 : userData.invites.total - 1
                }
            } else userData = {
                guildId: guild.id,
                userId: data.invitedBy,
                invites: {
                    regular: 0,
                    bonus: 0,
                    leaves: 1,
                    fake: 0,
                    total: 0
                }
            };
            await keyv.set(`invitestracker_${guild.id}_${data.invitedBy}`, userData);
            keyv.delete(`invitestracker_${guild.id}_${member.id}`);
        });
        
        this.getInvites = async function(user, guild) {
            if (!user || !guild) throw new Error('Please pass the user');
            let userData = await keyv.get(`invitestracker_${guild.id}_${user.id}`);
            if (!userData) return 0;
            else return userData.invites;
        };

        this.getAllInvites = async function(guild) {
            if (!guild) throw new Error('Please pass the guild');
            const users = keyv.all().filter(element => element.startsWith(`invitestracker_${guild.id}`))
            if (!users || users.length == 0) return 0;
            return users;
        };

        this.addBonusInvite = async function(user, guild, amount) {
            if (!user || !guild) throw new Error('Please pass the user');
            let userData = await keyv.get(`invitestracker_${guild.id}_${user.id}`);
            if (!userData || !userData.invites){
                userData = {
                    guildId: guild.id,
                    userId: user.id,
                    invites: {
                        regular: 0,
                        bonus: 0,
                        leaves: 0,
                        fake: 0,
                        total: 0
                    }
                };
            }
            userData.invites = {
                regular: userData.invites.regular,
                bonus: userData.invites.bonus + amount,
                leaves: userData.invites.leaves,
                fake: userData.invites.fake,
                total: userData.invites.total + amount
            }
            await keyv.set(`invitestracker_${guild.id}_${user.id}`, userData);
            return userData.invites;
        }

        this.removeBonusInvite = async function(user, guild, amount) {
            if (!user || !guild) throw new Error('Please pass the user');
            let userData = await keyv.get(`invitestracker_${guild.id}_${user.id}`);
            if (!userData || !userData.invites){
                userData = {
                    guildId: guild.id,
                    userId: user.id,
                    invites: {
                        regular: 0,
                        bonus: 0,
                        leaves: 0,
                        fake: 0,
                        total: 0
                    }
                };
            }
            userData.invites = {
                regular: userData.invites.regular,
                bonus: userData.invites.bonus - amount,
                leaves: userData.invites.leaves,
                fake: userData.invites.fake,
                total: userData.invites.total - amount < 0 ? 0 : userData.invites.total - amount
            }
            await keyv.set(`invitestracker_${guild.id}_${user.id}`, userData);
            return userData.invites;
        }
    };

};
