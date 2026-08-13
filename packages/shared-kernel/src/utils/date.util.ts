import { format, parseISO, addDays, subDays, isAfter, isBefore, isEqual } from 'date-fns';

export class DateUtil {
  static format(date: Date, pattern: string = 'yyyy-MM-dd HH:mm:ss'): string {
    return format(date, pattern);
  }

  static parse(dateString: string): Date {
    return parseISO(dateString);
  }

  static addDays(date: Date, days: number): Date {
    return addDays(date, days);
  }

  static subDays(date: Date, days: number): Date {
    return subDays(date, days);
  }

  static isAfter(date: Date, dateToCompare: Date): boolean {
    return isAfter(date, dateToCompare);
  }

  static isBefore(date: Date, dateToCompare: Date): boolean {
    return isBefore(date, dateToCompare);
  }

  static isEqual(date: Date, dateToCompare: Date): boolean {
    return isEqual(date, dateToCompare);
  }

  static now(): Date {
    return new Date();
  }

  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
