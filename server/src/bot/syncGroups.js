const groupsRepo = require('../db/repositories/groups');

function isNumericId(name, chatId) {
  if (!name) return true;
  const idPart = chatId.split('@')[0];
  return name === idPart || /^\d+$/.test(name);
}

async function syncGroupNames(botInstanceId, client) {
  try {
    const chats = await client.getChats();
    for (const chat of chats) {
      if (!chat.isGroup || !chat.name) continue;
      const chatId = chat.id._serialized;
      groupsRepo.upsert(botInstanceId, chatId, chat.name);
    }
  } catch (err) {
    console.error(`syncGroupNames getChats failed:`, err.message);
  }

  const known = groupsRepo.listChatIds(botInstanceId);
  for (const { chat_id } of known) {
    try {
      const chat = await client.getChatById(chat_id);
      if (chat?.isGroup && chat.name && !isNumericId(chat.name, chat_id)) {
        groupsRepo.updateName(botInstanceId, chat_id, chat.name);
      }
    } catch {
      // chat may no longer exist
    }
  }
}

module.exports = { syncGroupNames };
