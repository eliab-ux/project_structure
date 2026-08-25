import { Detection } from '../../../src/contexts/detection/domain/entities/detection.entity';
import { DetectionType } from '../../../src/contexts/detection/domain/value-objects/detection-type.vo';

describe('Detection entity', () => {
  it('is highlighted when it matches a watched account', () => {
    const d = Detection.register({
      ownerId: 'owner-1',
      sourceUsername: 'anamaria',
      detectionType: DetectionType.CAPTION_MENTION,
      watchedAccountId: 'wa-1',
    });
    expect(d.highlighted).toBe(true);
  });

  it('is not highlighted without a watched account', () => {
    const d = Detection.register({
      ownerId: 'owner-1',
      sourceUsername: 'randomguy',
      detectionType: DetectionType.COMMENT_MENTION,
    });
    expect(d.highlighted).toBe(false);
    expect(d.seen).toBe(false);
  });

  it('markSeen flips the seen flag', () => {
    const d = Detection.register({
      ownerId: 'owner-1',
      sourceUsername: 'x',
      detectionType: DetectionType.TAG,
    });
    d.markSeen();
    expect(d.seen).toBe(true);
  });
});
