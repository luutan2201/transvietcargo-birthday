import type { Customer } from '../types/entities';

/** true if the customer's birthDate (month/day) matches the given date. */
function isBirthdayOn(customer: Customer, month: number, day: number): boolean {
  if (!customer.birthDate) return false;
  const [, m, d] = customer.birthDate.split('-').map(Number);
  return m === month && d === day;
}

/**
 * Returns customers who need action TODAY, applying the company guideline:
 * "Nếu sinh nhật rơi vào Thứ 7 hoặc Chủ Nhật, Admin sẽ gửi quà vào Thứ 6
 * trước đó." So on a Friday, this also pulls in Saturday's and Sunday's
 * birthdays; on any other day, it's just that day's birthdays.
 */
export function getTodaysActionList(customers: Customer[], referenceDate: Date = new Date()): Customer[] {
  const dayOfWeek = referenceDate.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const targets: Date[] = [new Date(referenceDate)];

  if (dayOfWeek === 5) {
    // Friday — also cover the upcoming Saturday and Sunday.
    const sat = new Date(referenceDate);
    sat.setDate(sat.getDate() + 1);
    const sun = new Date(referenceDate);
    sun.setDate(sun.getDate() + 2);
    targets.push(sat, sun);
  }

  const monthDayPairs = targets.map((d) => ({ month: d.getMonth() + 1, day: d.getDate() }));

  return customers.filter((c) => monthDayPairs.some(({ month, day }) => isBirthdayOn(c, month, day)));
}

/** true if this customer's outreach for today is still incomplete. */
export function isPendingToday(customer: Customer): boolean {
  return !customer.ecardSent || (customer.greetingType === 'gift_visit' && !customer.giftGiven);
}
