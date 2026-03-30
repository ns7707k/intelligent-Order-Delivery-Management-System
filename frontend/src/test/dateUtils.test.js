/**
 * Tests for dateUtils utility functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDistanceToNow, formatDate, isToday } from '../utils/dateUtils';

describe('dateUtils', () => {
  describe('formatDistanceToNow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns seconds ago for < 1 minute', () => {
      const date = new Date('2024-06-15T11:59:30Z');
      expect(formatDistanceToNow(date)).toBe('30 seconds ago');
    });

    it('returns minutes ago for < 1 hour', () => {
      const date = new Date('2024-06-15T11:45:00Z');
      expect(formatDistanceToNow(date)).toBe('15 minutes ago');
    });

    it('returns singular minute', () => {
      const date = new Date('2024-06-15T11:59:00Z');
      expect(formatDistanceToNow(date)).toBe('1 minute ago');
    });

    it('returns hours ago for < 24 hours', () => {
      const date = new Date('2024-06-15T09:00:00Z');
      expect(formatDistanceToNow(date)).toBe('3 hours ago');
    });

    it('returns singular hour', () => {
      const date = new Date('2024-06-15T11:00:00Z');
      expect(formatDistanceToNow(date)).toBe('1 hour ago');
    });

    it('returns days ago for >= 24 hours', () => {
      const date = new Date('2024-06-13T12:00:00Z');
      expect(formatDistanceToNow(date)).toBe('2 days ago');
    });

    it('returns singular day', () => {
      const date = new Date('2024-06-14T12:00:00Z');
      expect(formatDistanceToNow(date)).toBe('1 day ago');
    });
  });

  describe('formatDate', () => {
    it('formats a date string to readable format', () => {
      const result = formatDate('2024-06-15T14:30:00Z');
      // Should contain month, day, year
      expect(result).toMatch(/Jun/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it('formats a Date object', () => {
      const result = formatDate(new Date('2024-01-01T00:00:00Z'));
      expect(result).toMatch(/2024/);
    });
  });

  describe('isToday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for today', () => {
      expect(isToday(new Date('2024-06-15T08:00:00Z'))).toBe(true);
    });

    it('returns false for yesterday', () => {
      expect(isToday(new Date('2024-06-14T12:00:00Z'))).toBe(false);
    });

    it('returns false for tomorrow', () => {
      expect(isToday(new Date('2024-06-16T12:00:00Z'))).toBe(false);
    });
  });
});
