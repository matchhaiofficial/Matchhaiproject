"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockUser = exports.removeFriend = exports.respondFriendRequest = exports.sendFriendRequest = exports.removeMember = exports.transferCaptain = exports.respondToJoinRequest = exports.requestToJoinTeam = exports.createTeam = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
const social = require("./social");
const teams = require("./teams");
// Teams
exports.createTeam = teams.createTeam;
exports.requestToJoinTeam = teams.requestToJoinTeam;
exports.respondToJoinRequest = teams.respondToJoinRequest;
exports.transferCaptain = teams.transferCaptain;
exports.removeMember = teams.removeMember;
// Social
exports.sendFriendRequest = social.sendFriendRequest;
exports.respondFriendRequest = social.respondFriendRequest;
exports.removeFriend = social.removeFriend;
exports.blockUser = social.blockUser;
//# sourceMappingURL=index.js.map