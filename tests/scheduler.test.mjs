import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCronField,
  matchesCron,
  calculateDateDelay,
  calculateIntervalSeconds,
  ClientScheduler
} from '../src/js/scheduler.js';

describe('Client-Side Scheduler & Timed Triggers Suite', () => {
  test('parseCronField handles wildcards, lists, ranges and steps correctly', () => {
    // Asterisk
    const all = parseCronField('*', 0, 5);
    assert.deepEqual(Array.from(all).sort((a,b)=>a-b), [0, 1, 2, 3, 4, 5]);

    // Step */15
    const steps = parseCronField('*/15', 0, 59);
    assert.deepEqual(Array.from(steps).sort((a,b)=>a-b), [0, 15, 30, 45]);

    // Range 1-4
    const range = parseCronField('1-4', 0, 10);
    assert.deepEqual(Array.from(range).sort((a,b)=>a-b), [1, 2, 3, 4]);

    // List 2,5,8
    const list = parseCronField('2,5,8', 0, 10);
    assert.deepEqual(Array.from(list).sort((a,b)=>a-b), [2, 5, 8]);
  });

  test('matchesCron evaluates date against 5-field cron correctly', () => {
    // 2026-09-07 14:30:00 (Monday)
    // 2026-09-07: month 9, day 7, monday is day 1
    const testDate = new Date('2026-09-07T14:30:00');

    // Matching: 30 14 * * 1
    assert.equal(matchesCron('30 14 * * 1', testDate), true);

    // Matching: */15 * * * *
    assert.equal(matchesCron('*/15 * * * *', testDate), true);

    // Non-matching minute: 45 14 * * *
    assert.equal(matchesCron('45 14 * * *', testDate), false);

    // Non-matching hour: 30 15 * * *
    assert.equal(matchesCron('30 15 * * *', testDate), false);

    // Non-matching day of week: 30 14 * * 0 (Sunday)
    assert.equal(matchesCron('30 14 * * 0', testDate), false);
  });

  test('calculateIntervalSeconds converts units accurately', () => {
    assert.equal(calculateIntervalSeconds(15, 'seconds'), 15);
    assert.equal(calculateIntervalSeconds(5, 'minutes'), 300);
    assert.equal(calculateIntervalSeconds(2, 'hours'), 7200);
    assert.equal(calculateIntervalSeconds(1, 'days'), 86400);
  });

  test('calculateDateDelay handles future and past dates', () => {
    const past = new Date(Date.now() - 10000).toISOString();
    assert.ok(calculateDateDelay(past) < 0);

    const future = new Date(Date.now() + 10000).toISOString();
    assert.ok(calculateDateDelay(future) > 0);
  });

  test('ClientScheduler starts, triggers on load and stops cleanly', async () => {
    let triggeredCount = 0;
    let lastReason = null;

    const scheduler = new ClientScheduler((node, ctx) => {
      triggeredCount++;
      lastReason = ctx.reason;
    });

    const mockWorkflow = {
      nodes: [
        {
          id: 'sched_1',
          type: 'schedule_trigger',
          params: {
            mode: 'interval',
            intervalValue: 1,
            intervalUnit: 'seconds',
            triggerOnLoad: true
          }
        }
      ]
    };

    scheduler.start(mockWorkflow);
    assert.equal(scheduler.isActive, true);

    // Wait for triggerOnLoad
    await new Promise(r => setTimeout(r, 400));
    assert.ok(triggeredCount >= 1);
    assert.equal(lastReason, 'triggerOnLoad');

    scheduler.stop();
    assert.equal(scheduler.isActive, false);
    assert.equal(scheduler.timers.length, 0);
  });
});
