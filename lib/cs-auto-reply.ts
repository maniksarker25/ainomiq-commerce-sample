export type AutoReplyChannel = 'email' | 'instagram' | 'facebook';

export type AutoReplySettings = {
  email: boolean;
  instagram: boolean;
  facebook: boolean;
};

export const DEFAULT_AUTO_REPLY: AutoReplySettings = {
  email: true,
  instagram: true,
  facebook: true,
};

export function parseAutoReplySettings(source: unknown): AutoReplySettings {
  const raw =
    source && typeof source === 'object'
      ? (source as Record<string, unknown>).auto_reply
      : null;

  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AUTO_REPLY };
  }

  const obj = raw as Record<string, unknown>;
  return {
    email: typeof obj.email === 'boolean' ? obj.email : DEFAULT_AUTO_REPLY.email,
    instagram:
      typeof obj.instagram === 'boolean'
        ? obj.instagram
        : DEFAULT_AUTO_REPLY.instagram,
    facebook:
      typeof obj.facebook === 'boolean'
        ? obj.facebook
        : DEFAULT_AUTO_REPLY.facebook,
  };
}

export function mergeAutoReplySettings(
  current: AutoReplySettings,
  patch: Partial<AutoReplySettings>,
): AutoReplySettings {
  return {
    email: typeof patch.email === 'boolean' ? patch.email : current.email,
    instagram:
      typeof patch.instagram === 'boolean'
        ? patch.instagram
        : current.instagram,
    facebook:
      typeof patch.facebook === 'boolean' ? patch.facebook : current.facebook,
  };
}

const AUTO_REPLY_CHANNELS: AutoReplyChannel[] = ['email', 'instagram', 'facebook'];

/** Merge auto_reply blocks from multiple tenant rows. Explicit false always wins. */
export function combineAutoReplyFromRecords(
  records: Array<Record<string, unknown>>,
  preferredRecord?: Record<string, unknown>,
): AutoReplySettings {
  if (records.length === 0) return { ...DEFAULT_AUTO_REPLY };

  const ordered = preferredRecord
    ? [...records.filter((record) => record !== preferredRecord), preferredRecord]
    : records;

  let settings: AutoReplySettings = { ...DEFAULT_AUTO_REPLY };
  let sawExplicitAutoReply = false;

  for (const record of ordered) {
    const autoReply = record.auto_reply;
    if (!autoReply || typeof autoReply !== 'object') continue;
    sawExplicitAutoReply = true;
    const obj = autoReply as Record<string, unknown>;
    for (const channel of AUTO_REPLY_CHANNELS) {
      if (obj[channel] === false) settings[channel] = false;
    }
  }

  for (const record of ordered) {
    const autoReply = record.auto_reply;
    if (!autoReply || typeof autoReply !== 'object') continue;
    const obj = autoReply as Record<string, unknown>;
    for (const channel of AUTO_REPLY_CHANNELS) {
      if (obj[channel] === true && settings[channel] !== false) {
        settings[channel] = true;
      }
    }
  }

  if (!sawExplicitAutoReply) {
    return parseAutoReplySettings(records[0]);
  }

  return settings;
}
