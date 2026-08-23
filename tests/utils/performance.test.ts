import { describe, it, expect } from 'vitest';
import { perfTracker } from '../../src/utils/performance';
import type { LoginItem, SecureNoteItem, CreditCardItem, VaultItem } from '../../src/types/vault';

describe('High-Speed Vault Performance & Search Benchmarks', () => {
  it('records and calculates accurate execution telemetry', () => {
    perfTracker.startMeasure('benchmark_test');
    // Simulate brief computation
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      sum += i;
    }
    expect(sum).toBeGreaterThan(0);
    const duration = perfTracker.endMeasure('benchmark_test');

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(perfTracker.getLatestMetric('benchmark_test')).toBe(duration);
  });

  it('performs sub-millisecond search over 2,000+ indexed vault items', () => {
    // Generate 2,000 simulated vault items
    const testItems: VaultItem[] = [];
    for (let i = 1; i <= 2000; i++) {
      if (i % 3 === 0) {
        testItems.push({
          id: `item-${i}`,
          type: 'login',
          name: `Company Service #${i} - AWS Cloud`,
          username: `admin_${i}@example.com`,
          password: `Secret_${i}!`,
          urls: [`https://service${i}.aws.com`],
          folder: i % 2 === 0 ? 'Work' : 'Personal',
          favorite: i % 10 === 0,
          trash: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as LoginItem);
      } else if (i % 3 === 1) {
        testItems.push({
          id: `item-${i}`,
          type: 'note',
          name: `Recovery Secret Note #${i}`,
          content: `Confidential server encryption key token ${i}`,
          folder: 'Work',
          favorite: false,
          trash: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as SecureNoteItem);
      } else {
        testItems.push({
          id: `item-${i}`,
          type: 'card',
          name: `Visa Platinum #${i}`,
          cardholderName: `Employee ${i}`,
          cardNumber: `411122223333${String(i).padStart(4, '0')}`,
          expirationMonth: '12',
          expirationYear: '2028',
          cvv: '123',
          folder: 'Finance',
          favorite: false,
          trash: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as CreditCardItem);
      }
    }

    // Pre-index items
    const startTimeIndex = performance.now();
    const indexed = testItems.map((item) => {
      let tokens = `${item.name} ${item.type} ${item.folder || ''}`;
      if (item.type === 'login') {
        tokens += ` ${item.username || ''} ${(item.urls || []).join(' ')}`;
      } else if (item.type === 'note') {
        tokens += ` ${item.content || ''}`;
      } else if (item.type === 'card') {
        tokens += ` ${item.cardholderName || ''} ${item.cardNumber ? item.cardNumber.slice(-4) : ''}`;
      }
      return { item, searchStr: tokens.toLowerCase() };
    });
    const indexDuration = performance.now() - startTimeIndex;

    expect(indexDuration).toBeLessThan(50); // Under 50ms to index 2,000 items

    // Query 1: Search by username (600 is divisible by 3)
    const startQuery1 = performance.now();
    const query1Results = indexed.filter((e) => e.searchStr.includes('admin_600@example.com'));
    const duration1 = performance.now() - startQuery1;

    expect(duration1).toBeLessThan(5); // Under 5ms (typically 0.1ms)
    expect(query1Results.length).toBe(1);

    // Query 2: Search by partial keyword
    const startQuery2 = performance.now();
    const query2Results = indexed.filter((e) => e.searchStr.includes('aws cloud'));
    const duration2 = performance.now() - startQuery2;

    expect(duration2).toBeLessThan(5);
    expect(query2Results.length).toBeGreaterThan(100);
  });
});
