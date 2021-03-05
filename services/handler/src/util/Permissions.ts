import { BitField, BitFieldResolvable } from '@cordis/bitfield';

const PERMISSIONS = BitField.makeFlags([
  'createInstantInvite',
  'kickMembers',
  'banMembers',
  'administrator',
  'manageChannels',
  'manageGuild',
  'addReactions',
  'viewAuditLog',
  'prioritySpeaker',
  'stream',
  'viewChannel',
  'sendMessages',
  'sendTTSMessages',
  'manageMessages',
  'embedLinks',
  'attachFiles',
  'readMessageHistory',
  'mentionEveryone',
  'useExternalEmojis',
  'viewGuildInsights',
  'connect',
  'speak',
  'muteMembers',
  'deafenMembers',
  'moveMembers',
  'useVAD',
  'changeNickname',
  'manageNicknames',
  'manageRoles',
  'manageWebhooks',
  'manageEmojis'
]);

type PermissionKey = keyof(typeof PERMISSIONS);

export class Permissions extends BitField<PermissionKey> {
  public constructor(bits: BitFieldResolvable<PermissionKey>) {
    super(PERMISSIONS, bits);
  }

  public any(permission: BitFieldResolvable<PermissionKey>, checkAdmin = true) {
    return (checkAdmin && super.has(PERMISSIONS.administrator)) || super.any(permission);
  }

  public has(permission: BitFieldResolvable<PermissionKey>, checkAdmin = true) {
    return (checkAdmin && super.has(PERMISSIONS.administrator)) || super.has(permission);
  }
}
