import * as admin from 'firebase-admin';

admin.initializeApp();

import * as social from './social';
import * as teams from './teams';

// Teams
export const createTeam = teams.createTeam;
export const requestToJoinTeam = teams.requestToJoinTeam;
export const respondToJoinRequest = teams.respondToJoinRequest;
export const transferCaptain = teams.transferCaptain;
export const removeMember = teams.removeMember;

// Social
export const sendFriendRequest = social.sendFriendRequest;
export const respondFriendRequest = social.respondFriendRequest;
export const removeFriend = social.removeFriend;
export const blockUser = social.blockUser;

