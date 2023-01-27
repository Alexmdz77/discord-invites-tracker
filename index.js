const { EventEmitter } = require('events');

const { QuickDB } = require('quick.db')
const db = new QuickDB({ filePath: 'invites.sqlite' });

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
                    const user = await client.users.fetch(inviter);
                    let data = {
                        guildId: guild.id,
                        userId: member.id,
                        invitedBy: user
                    };
                    await db.set(`invitestracker_${guild.id}_${member.id}`, data);
                    member.inviter = user;
                    let getData = await new Promise(async (resolve) => {
                        let userData = await db.get(`invitestracker_${guild.id}_${inviter}`);
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
                        await db.set(`invitestracker_${guild.id}_${inviter}`, userData);
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
            await db.set(`invitestracker_${guild.id}_${member.id}`, data);
            let getData = await new Promise(async (resolve) => {
                let userData = await db.get(`invitestracker_${guild.id}_${member.id}`);
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
                await db.set(`invitestracker_${guild.id}_${member.id}`, userData);
                resolve(userData);
            });
            member.invites = getData.invites;
            return this.emit('guildMemberAdd', member);
        });

        this.client.on('guildMemberRemove', async (member) => {
            const { guild } = member;
            let data = await db.get(`invitestracker_${guild.id}_${member.id}`);
            if (!data) return;
            let userData = await db.get(`invitestracker_${guild.id}_${data.invitedBy.id}`);
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
                userId: data.invitedBy.id,
                invites: {
                    regular: 0,
                    bonus: 0,
                    leaves: 1,
                    fake: 0,
                    total: 0
                }
            };
            await db.set(`invitestracker_${guild.id}_${data.invitedBy.id}`, userData);
            db.delete(`invitestracker_${guild.id}_${member.id}`);
        });

        this.getUserData = async function(member) {
            if (!member) throw new Error('Please pass the member');
            let userData = await db.get(`invitestracker_${member.guild.id}_${member.id}`);
            if (!userData) {
                userData = {
                    guildId: member.guild.id,
                    userId: member.id,
                    invitedBy: null
                };
            }
            if (!userData.invites) {
                userData.invites = {
                    regular: 0,
                    bonus: 0,
                    leaves: 0,
                    fake: 0,
                    total: 0
                }
            }
            return userData;
        };
        
        this.getInvites = async function(member) {
            if (!member) throw new Error('Please pass the member');
            let userData = await db.get(`invitestracker_${member.guild.id}_${member.id}`);
            if (!userData) {
                userData = {
                    guildId: member.guild.id,
                    userId: member.id,
                    invitedBy: null
                };
            }
            if (!userData.invites) {
                userData.invites = {
                    regular: 0,
                    bonus: 0,
                    leaves: 0,
                    fake: 0,
                    total: 0
                }
            }
            else return userData.invites;
        };

        this.getAllInvites = async function(guild) {
            if (!guild) throw new Error('Please pass the guild');
            const users = (await db.all()).filter(element => element.id.startsWith(`invitestracker_${guild.id}`))
                .map(element => {
                    if (!element.value.invites) {
                        element.value.invites = {
                            regular: 0,
                            bonus: 0,
                            leaves: 0,
                            fake: 0,
                            total: 0
                        }
                    }
                return element.value;
            })
            if (!users || users.length == 0) return null;
            return users;
        };

        this.addBonusInvites = async function(member, amount) {
            if (!member) throw new Error('Please pass the member');
            let userData = await db.get(`invitestracker_${member.guild.id}_${member.user.id}`);
            if (!userData || !userData.invites){
                userData = {
                    guildId: member.guild.id,
                    userId: member.user.id,
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
            await db.set(`invitestracker_${member.guild.id}_${member.user.id}`, userData);
            return userData.invites;
        }

        this.removeBonusInvites = async function(user, guild, amount) {
            if (!user || !guild) throw new Error('Please pass the user');
            let userData = await db.get(`invitestracker_${guild.id}_${user.id}`);
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
            await db.set(`invitestracker_${guild.id}_${user.id}`, userData);
            return userData.invites;
        }
    };

};
