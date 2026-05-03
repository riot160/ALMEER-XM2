export const commands = {
  kick: async ({ isGroup, reply }) => reply(isGroup ? 'Kick logic stub.' : 'Group only.'),
  add: async ({ isGroup, reply }) => reply(isGroup ? 'Add logic stub.' : 'Group only.'),
  promote: async ({ isGroup, reply }) => reply(isGroup ? 'Promote logic stub.' : 'Group only.'),
  demote: async ({ isGroup, reply }) => reply(isGroup ? 'Demote logic stub.' : 'Group only.'),
  mute: async ({ isGroup, reply }) => reply(isGroup ? 'Mute logic stub.' : 'Group only.'),
  unmute: async ({ isGroup, reply }) => reply(isGroup ? 'Unmute logic stub.' : 'Group only.'),
  groupinfo: async ({ isGroup, reply }) => reply(isGroup ? 'Group info stub.' : 'Group only.'),
  tagall: async ({ isGroup, reply }) => reply(isGroup ? 'Tag all stub.' : 'Group only.')
};
