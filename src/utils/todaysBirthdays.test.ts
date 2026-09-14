import { describe, it, expect } from 'vitest';
import { getTodaysActionList, isPendingToday } from './todaysBirthdays';
import type { Customer } from '../types/entities';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: overrides.id ?? Math.random().toString(),
    year: 2026,
    createdAt: '', updatedAt: '',
    fullName: 'Test', firstName: 'Test', lastName: '',
    gender: 'unknown', email: 'a@test.com', language: 'vi', status: 'active',
    greetingType: 'ecard_only', station: 'SGN', ecardSent: false, giftGiven: false,
    ...overrides,
  };
}

describe('getTodaysActionList', () => {
  it('returns only today\'s birthdays on a normal weekday', () => {
    // Wednesday, 2026-03-11
    const today = new Date(2026, 2, 11);
    const customers = [
      makeCustomer({ id: '1', birthDate: '1990-03-11' }), // today
      makeCustomer({ id: '2', birthDate: '1990-03-12' }), // tomorrow, not included
      makeCustomer({ id: '3', birthDate: '1990-03-10' }), // yesterday, not included
    ];
    const result = getTodaysActionList(customers, today);
    expect(result.map((c) => c.id)).toEqual(['1']);
  });

  it('pulls in Saturday and Sunday birthdays when today is Friday', () => {
    // Friday, 2026-03-13
    const today = new Date(2026, 2, 13);
    const customers = [
      makeCustomer({ id: 'fri', birthDate: '1990-03-13' }),
      makeCustomer({ id: 'sat', birthDate: '1990-03-14' }),
      makeCustomer({ id: 'sun', birthDate: '1990-03-15' }),
      makeCustomer({ id: 'mon', birthDate: '1990-03-16' }), // not included
    ];
    const result = getTodaysActionList(customers, today);
    expect(result.map((c) => c.id).sort()).toEqual(['fri', 'sat', 'sun']);
  });
});

describe('isPendingToday', () => {
  it('is pending when eCard not sent', () => {
    expect(isPendingToday(makeCustomer({ ecardSent: false }))).toBe(true);
  });
  it('is not pending for eCard-only once sent', () => {
    expect(isPendingToday(makeCustomer({ ecardSent: true, greetingType: 'ecard_only' }))).toBe(false);
  });
  it('is still pending for gift_visit until gift is also given', () => {
    expect(isPendingToday(makeCustomer({ ecardSent: true, greetingType: 'gift_visit', giftGiven: false }))).toBe(true);
    expect(isPendingToday(makeCustomer({ ecardSent: true, greetingType: 'gift_visit', giftGiven: true }))).toBe(false);
  });
});
