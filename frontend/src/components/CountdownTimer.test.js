import React from 'react';
import { render, screen, act } from '@testing-library/react';
import CountdownTimer from '../components/CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows "Ended" for a past end time', () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    render(<CountdownTimer endTime={pastTime} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  test('shows remaining days for an end time far in the future', () => {
    const futureTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer endTime={futureTime} />);
    // Expects something like "3d 00h 00m"
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  test('shows hours/minutes/seconds for end time within 24 hours', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    render(<CountdownTimer endTime={futureTime} />);
    // Expects something like "02h 00m 00s"
    expect(screen.getByText(/\d+h \d+m \d+s/)).toBeInTheDocument();
  });

  test('applies timer CSS class for active countdowns', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { container } = render(<CountdownTimer endTime={futureTime} />);
    expect(container.querySelector('.timer')).not.toBeNull();
  });

  test('does not apply timer CSS class when ended', () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const { container } = render(<CountdownTimer endTime={pastTime} />);
    expect(container.querySelector('.timer')).toBeNull();
  });

  test('updates countdown every second', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes
    render(<CountdownTimer endTime={futureTime} />);

    const initialText = screen.getByText(/\d+h \d+m \d+s/).textContent;

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const updatedText = screen.getByText(/\d+h \d+m \d+s/).textContent;
    expect(updatedText).not.toBe(initialText);
  });

  test('transitions to "Ended" when timer expires', () => {
    const futureTime = new Date(Date.now() + 2000).toISOString(); // 2 seconds
    render(<CountdownTimer endTime={futureTime} />);

    expect(screen.queryByText('Ended')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Ended')).toBeInTheDocument();
  });
});
