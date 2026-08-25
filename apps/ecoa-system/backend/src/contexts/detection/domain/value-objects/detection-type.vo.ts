import { ValueObject } from '@gitspread/domain-primitives';

/**
 * What kind of signal produced a detection. These are exactly the signals the Instagram Graph
 * API exposes — no more.
 *
 * ⚠️ There is deliberately NO story_mention here. Meta's docs are explicit: "Mentions on
 * Stories are not supported" by the Instagram API with Facebook Login. Story reshares reach
 * an app only through the Instagram MESSAGING API (`story_mention` webhook +
 * `instagram_manage_messages`), a different product with its own App Review track. An earlier
 * version of this file claimed story_mention and it was never true — it mapped the `mentions`
 * webhook field, which is caption/comment mentions.
 * See https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/mentions/
 */
export type DetectionTypeValue = 'caption_mention' | 'comment_mention' | 'tag';

export class DetectionType extends ValueObject<{ value: DetectionTypeValue }> {
  /** Someone published a post whose CAPTION @mentions the tenant — the repost signal. */
  static readonly CAPTION_MENTION = new DetectionType({ value: 'caption_mention' });
  /** Someone @mentioned the tenant in a COMMENT on a media the tenant does not own. */
  static readonly COMMENT_MENTION = new DetectionType({ value: 'comment_mention' });
  /** The tenant was TAGGED in someone else's media (`/tags` edge). */
  static readonly TAG = new DetectionType({ value: 'tag' });

  private constructor(props: { value: DetectionTypeValue }) {
    super(props);
  }

  get value(): DetectionTypeValue {
    return this.props.value;
  }

  static from(value: string | null | undefined): DetectionType {
    switch ((value ?? '').toLowerCase()) {
      case 'caption_mention':
        return DetectionType.CAPTION_MENTION;
      case 'comment_mention':
        return DetectionType.COMMENT_MENTION;
      case 'tag':
        return DetectionType.TAG;
      default:
        throw new Error(`Invalid detection type: ${value}`);
    }
  }
}
