import test from 'node:test';
import assert from 'node:assert/strict';
import { sumGoalSavings } from '../src/utils/finance.js';

test('unallocated family goals share one pool instead of being summed per goal', () => {
  const goals = [
    { id: 'a', memberId: 'all', currentAmount: 500000, allocations: [] },
    { id: 'b', memberId: 'all', currentAmount: 500000, allocations: [] },
    { id: 'c', memberId: 'all', currentAmount: 500000 },
  ];
  assert.equal(sumGoalSavings(goals), 500000);
});

test('allocated goals add up, member pools count once each', () => {
  const goals = [
    { id: 'a', memberId: 'm1', currentAmount: 120000, allocations: [{ amount: 120000 }] },
    { id: 'b', memberId: 'm2', currentAmount: 300000 },
    { id: 'c', memberId: 'm2', currentAmount: 300000 },
    { id: 'd', memberId: 'm3', currentAmount: 50000 },
  ];
  assert.equal(sumGoalSavings(goals), 120000 + 300000 + 50000);
});

test('a family pool supersedes member pools and allocations', () => {
  const goals = [
    { id: 'a', memberId: 'm1', currentAmount: 120000, allocations: [{ amount: 120000 }] },
    { id: 'b', memberId: 'all', currentAmount: 900000 },
  ];
  assert.equal(sumGoalSavings(goals), 900000);
  assert.equal(sumGoalSavings([]), 0);
});
